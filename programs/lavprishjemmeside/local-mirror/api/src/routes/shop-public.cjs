'use strict';

/**
 * Public shop endpoints — no auth required.
 * Mounted at /shop in server.cjs
 */

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { rateLimit } = require('express-rate-limit');
const pool = require('../db');
const { createCheckoutSession } = require('../services/flatpay.cjs');

const router = express.Router();

const orderRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: 'For mange forsøg. Prøv igen om 15 minutter.' }),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Generate next order number: LPH-10001 */
async function nextOrderNumber(conn) {
  const [[settings]] = await conn.query('SELECT order_sequence_start FROM shop_settings WHERE id = 1');
  const start = settings?.order_sequence_start || 10001;
  const [[{ cnt }]] = await conn.query('SELECT COUNT(*) AS cnt FROM orders');
  return `LPH-${start + Number(cnt)}`;
}

/** Safe integer øre parser (rejects negative / non-int) */
function parseOre(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// ─── GET /shop/products ──────────────────────────────────────────────────────
router.get('/products', async (req, res) => {
  try {
    const { category, featured, search, page = 1, limit = 24, min_price_ore, max_price_ore, in_stock_only, sort } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit) || 24);
    const pageSize = Math.min(100, parseInt(limit) || 24);

    let where = ['p.is_active = 1'];
    const params = [];

    if (category) {
      where.push('c.slug = ?');
      params.push(category);
    }
    if (featured === '1' || featured === 'true') {
      where.push('p.is_featured = 1');
    }
    if (search) {
      where.push('MATCH(p.name, p.short_desc) AGAINST(? IN BOOLEAN MODE)');
      params.push(search + '*');
    }
    if (min_price_ore) {
      where.push('p.price_ore >= ?');
      params.push(parseInt(min_price_ore));
    }
    if (max_price_ore) {
      where.push('p.price_ore <= ?');
      params.push(parseInt(max_price_ore));
    }
    if (in_stock_only === '1' || in_stock_only === 'true') {
      where.push('(p.track_stock = 0 OR p.stock > 0)');
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    let orderBy = 'p.is_featured DESC, p.created_at DESC';
    if (sort === 'price_asc') orderBy = 'p.price_ore ASC';
    else if (sort === 'price_desc') orderBy = 'p.price_ore DESC';
    else if (sort === 'newest') orderBy = 'p.created_at DESC';
    else if (sort === 'featured') orderBy = 'p.is_featured DESC, p.created_at DESC';

    const [products] = await pool.query(`
      SELECT p.id, p.name, p.slug, p.short_desc, p.price_ore, p.compare_ore,
             p.is_featured, p.stock, p.track_stock,
             c.name AS category_name, c.slug AS category_slug,
             (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) AS primary_image
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `, [...params, pageSize, offset]);

    const [[{ total }]] = await pool.query(`
      SELECT COUNT(*) AS total FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      ${whereClause}
    `, params);

    res.json({ products, total, page: parseInt(page), limit: pageSize });
  } catch (err) {
    console.error('GET /shop/products:', err.message);
    res.status(500).json({ error: 'Kunne ikke hente produkter' });
  }
});

// ─── GET /shop/products/:slug ────────────────────────────────────────────────
router.get('/products/:slug', async (req, res) => {
  try {
    const [[product]] = await pool.query(`
      SELECT p.*, c.name AS category_name, c.slug AS category_slug
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE p.slug = ? AND p.is_active = 1
    `, [req.params.slug]);

    if (!product) return res.status(404).json({ error: 'Produkt ikke fundet' });

    const [variants] = await pool.query(
      'SELECT * FROM product_variants WHERE product_id = ? AND is_active = 1 ORDER BY sort_order',
      [product.id]
    );
    const [images] = await pool.query(
      'SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order',
      [product.id]
    );

    res.json({ ...product, variants, images });
  } catch (err) {
    console.error('GET /shop/products/:slug:', err.message);
    res.status(500).json({ error: 'Kunne ikke hente produkt' });
  }
});

// ─── GET /shop/categories ────────────────────────────────────────────────────
router.get('/categories', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM product_categories WHERE is_active = 1 ORDER BY sort_order, name'
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /shop/categories:', err.message);
    res.status(500).json({ error: 'Kunne ikke hente kategorier' });
  }
});

// ─── POST /shop/cart/validate ────────────────────────────────────────────────
router.post('/cart/validate', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Ingen varer i kurven' });
    }

    const results = [];
    for (const item of items) {
      const pid = parseInt(item.product_id);
      const vid = item.variant_id ? parseInt(item.variant_id) : null;
      const qty = parseInt(item.quantity) || 1;

      const [[product]] = await pool.query(
        'SELECT id, name, price_ore, stock, track_stock FROM products WHERE id = ? AND is_active = 1',
        [pid]
      );
      if (!product) {
        results.push({ product_id: pid, ok: false, error: 'Produkt ikke tilgængeligt' });
        continue;
      }

      let priceOre = product.price_ore;
      let stock = product.stock;

      if (vid) {
        const [[variant]] = await pool.query(
          'SELECT id, price_ore, stock FROM product_variants WHERE id = ? AND product_id = ? AND is_active = 1',
          [vid, pid]
        );
        if (!variant) {
          results.push({ product_id: pid, variant_id: vid, ok: false, error: 'Variant ikke tilgængelig' });
          continue;
        }
        if (variant.price_ore !== null) priceOre = variant.price_ore;
        stock = variant.stock;
      }

      const stockOk = !product.track_stock || stock >= qty;
      results.push({
        product_id: pid,
        variant_id: vid,
        ok: stockOk,
        price_ore: priceOre,
        stock_available: stock,
        error: stockOk ? null : `Kun ${stock} på lager`,
      });
    }

    res.json({ items: results });
  } catch (err) {
    console.error('POST /shop/cart/validate:', err.message);
    res.status(500).json({ error: 'Validering fejlede' });
  }
});

// ─── GET /shop/shipping/methods ──────────────────────────────────────────────
router.get('/shipping/methods', async (req, res) => {
  try {
    const { country } = req.query;
    let [methods] = await pool.query(
      'SELECT * FROM shipping_methods WHERE is_active = 1 ORDER BY sort_order'
    );
    if (country) {
      const cc = country.toUpperCase().substring(0, 2);
      methods = methods.filter(m => {
        if (!m.countries) return true;
        try {
          const list = typeof m.countries === 'string' ? JSON.parse(m.countries) : m.countries;
          return Array.isArray(list) ? list.includes(cc) : true;
        } catch { return true; }
      });
    }
    res.json(methods);
  } catch (err) {
    console.error('GET /shop/shipping/methods:', err.message);
    res.status(500).json({ error: 'Kunne ikke hente forsendelsesmetoder' });
  }
});

// ─── POST /shop/discount/validate ───────────────────────────────────────────
router.post('/discount/validate', async (req, res) => {
  try {
    const { code, subtotal_ore } = req.body;
    if (!code) return res.status(400).json({ error: 'Kode mangler' });

    const [[dc]] = await pool.query(`
      SELECT * FROM discount_codes
      WHERE code = ? AND is_active = 1
        AND (valid_from IS NULL OR valid_from <= NOW())
        AND (valid_to IS NULL OR valid_to >= NOW())
        AND (max_uses IS NULL OR uses_count < max_uses)
    `, [code.trim().toUpperCase()]);

    if (!dc) return res.status(404).json({ error: 'Ugyldig eller udløbet rabatkode' });

    const sub = parseInt(subtotal_ore) || 0;
    if (dc.min_order_ore > 0 && sub < dc.min_order_ore) {
      return res.status(400).json({ error: `Rabatkoden kræver minimum ${(dc.min_order_ore / 100).toFixed(2).replace('.', ',')} kr.` });
    }

    let discountOre = 0;
    if (dc.type === 'percent') {
      discountOre = Math.round(sub * (dc.value / 100));
    } else if (dc.type === 'fixed') {
      discountOre = Math.min(Math.round(dc.value * 100), sub);
    }

    res.json({
      ok: true,
      code: dc.code,
      type: dc.type,
      value: dc.value,
      discount_ore: discountOre,
    });
  } catch (err) {
    console.error('POST /shop/discount/validate:', err.message);
    res.status(500).json({ error: 'Validering fejlede' });
  }
});

// ─── POST /shop/orders ───────────────────────────────────────────────────────
router.post('/orders', orderRateLimiter, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { items, customer, shipping_method_id, discount_code, customer_note, session_token } = req.body;

    // Basic input validation
    if (!Array.isArray(items) || items.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: 'Ingen varer i kurven' });
    }
    if (!customer?.email || !customer?.first_name || !customer?.last_name) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: 'Kundeoplysninger mangler' });
    }
    if (!shipping_method_id) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: 'Vælg en forsendelsesmetode' });
    }

    // Fetch shipping method
    const [[shipping]] = await conn.query(
      'SELECT * FROM shipping_methods WHERE id = ? AND is_active = 1',
      [parseInt(shipping_method_id)]
    );
    if (!shipping) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: 'Ugyldig forsendelsesmetode' });
    }

    // Server-side price + stock validation for each item
    let subtotalOre = 0;
    const validatedItems = [];

    for (const item of items) {
      const pid = parseInt(item.product_id);
      const vid = item.variant_id ? parseInt(item.variant_id) : null;
      const qty = Math.max(1, Math.min(99, parseInt(item.quantity) || 1));

      const [[product]] = await conn.query(
        'SELECT id, name, slug, price_ore, stock, track_stock FROM products WHERE id = ? AND is_active = 1',
        [pid]
      );
      if (!product) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ error: `Produkt id ${pid} er ikke tilgængeligt` });
      }

      let priceOre = product.price_ore;
      let variantName = null;
      let variantSku = null;
      let stockToCheck = product.stock;
      let trackStock = product.track_stock;

      if (vid) {
        const [[variant]] = await conn.query(
          'SELECT id, name, sku, price_ore, stock FROM product_variants WHERE id = ? AND product_id = ? AND is_active = 1',
          [vid, pid]
        );
        if (!variant) {
          await conn.rollback();
          conn.release();
          return res.status(400).json({ error: `Variant id ${vid} er ikke tilgængelig` });
        }
        if (variant.price_ore !== null) priceOre = variant.price_ore;
        variantName = variant.name;
        variantSku = variant.sku;
        stockToCheck = variant.stock;
      }

      if (trackStock && stockToCheck < qty) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ error: `Utilstrækkelig lager for "${product.name}"` });
      }

      // Fetch primary image
      const [[img]] = await conn.query(
        'SELECT url FROM product_images WHERE product_id = ? AND is_primary = 1 LIMIT 1',
        [pid]
      );

      const totalLine = priceOre * qty;
      subtotalOre += totalLine;

      validatedItems.push({
        product_id: pid,
        variant_id: vid,
        product_name: product.name,
        variant_name: variantName,
        sku: variantSku || null,
        quantity: qty,
        unit_price_ore: priceOre,
        total_price_ore: totalLine,
        image_url: img?.url || null,
      });
    }

    // Discount
    let discountOre = 0;
    let discountCodeId = null;
    let discountCodeStr = null;

    if (discount_code) {
      const [[dc]] = await conn.query(`
        SELECT * FROM discount_codes
        WHERE code = ? AND is_active = 1
          AND (valid_from IS NULL OR valid_from <= NOW())
          AND (valid_to IS NULL OR valid_to >= NOW())
          AND (max_uses IS NULL OR uses_count < max_uses)
      `, [discount_code.trim().toUpperCase()]);

      if (dc) {
        if (dc.type === 'percent') {
          discountOre = Math.round(subtotalOre * (dc.value / 100));
        } else if (dc.type === 'fixed') {
          discountOre = Math.min(Math.round(dc.value * 100), subtotalOre);
        } else if (dc.type === 'free_shipping') {
          discountOre = shipping.price_ore;
        }
        discountCodeId = dc.id;
        discountCodeStr = dc.code;
      }
    }

    // Shipping price (free if above threshold)
    let shippingOre = shipping.price_ore;
    if (shipping.free_above_ore !== null && subtotalOre >= shipping.free_above_ore) {
      shippingOre = 0;
    }
    if (discountCodeStr && discountOre === shipping.price_ore) {
      shippingOre = 0;
      discountOre = shipping.price_ore;
    }

    const vatRate = 0.25;
    const totalOre = Math.max(0, subtotalOre + shippingOre - discountOre);
    const vatOre = Math.round(totalOre - totalOre / (1 + vatRate));

    // Upsert customer
    const emailNorm = customer.email.trim().toLowerCase();
    await conn.query(`
      INSERT INTO customers (email, first_name, last_name, phone, address1, address2, city, zip, country)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        first_name = VALUES(first_name), last_name = VALUES(last_name),
        phone = VALUES(phone), address1 = VALUES(address1),
        address2 = VALUES(address2), city = VALUES(city),
        zip = VALUES(zip), country = VALUES(country),
        updated_at = NOW()
    `, [
      emailNorm,
      customer.first_name?.trim() || '',
      customer.last_name?.trim() || '',
      customer.phone?.trim() || null,
      customer.address1?.trim() || '',
      customer.address2?.trim() || null,
      customer.city?.trim() || '',
      customer.zip?.trim() || '',
      customer.country?.trim() || 'DK',
    ]);

    const [[cust]] = await conn.query('SELECT id FROM customers WHERE email = ?', [emailNorm]);
    const customerId = cust.id;

    // Create order
    const orderNumber = await nextOrderNumber(conn);
    const token = crypto.randomBytes(32).toString('hex');

    const [orderResult] = await conn.query(`
      INSERT INTO orders (
        order_number, token, customer_id, status,
        subtotal_ore, shipping_ore, discount_ore, total_ore, vat_ore,
        shipping_method_id, shipping_name,
        discount_code_id, discount_code,
        ship_first_name, ship_last_name, ship_email, ship_phone,
        ship_address1, ship_address2, ship_city, ship_zip, ship_country,
        customer_note
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      orderNumber, token, customerId, 'pending_payment',
      subtotalOre, shippingOre, discountOre, totalOre, vatOre,
      shipping.id, shipping.name,
      discountCodeId, discountCodeStr,
      customer.first_name?.trim(), customer.last_name?.trim(), emailNorm,
      customer.phone?.trim() || null,
      customer.address1?.trim(), customer.address2?.trim() || null,
      customer.city?.trim(), customer.zip?.trim(), customer.country?.trim() || 'DK',
      customer_note ? customer_note.trim().substring(0, 1000) : null,
    ]);

    const orderId = orderResult.insertId;

    // Insert order items
    for (const it of validatedItems) {
      await conn.query(`
        INSERT INTO order_items (order_id, product_id, variant_id, product_name, variant_name, sku, quantity, unit_price_ore, total_price_ore, image_url)
        VALUES (?,?,?,?,?,?,?,?,?,?)
      `, [orderId, it.product_id, it.variant_id, it.product_name, it.variant_name, it.sku, it.quantity, it.unit_price_ore, it.total_price_ore, it.image_url]);
    }

    // Create Frisbii checkout session
    const acceptBaseUrl = process.env.FLATPAY_ACCEPT_URL || 'https://lavprishjemmeside.dk/shop/ordre';
    const cancelUrl = process.env.FLATPAY_CANCEL_URL || 'https://lavprishjemmeside.dk/shop/checkout?cancelled=1';

    const { sessionId } = await createCheckoutSession({
      orderHandle: orderNumber,
      amountOre: totalOre,
      orderText: `Ordre ${orderNumber}`,
      customer: {
        handle: emailNorm,
        first_name: customer.first_name?.trim() || '',
        last_name: customer.last_name?.trim() || '',
        email: emailNorm,
      },
      acceptUrl: `${acceptBaseUrl}/${token}`,
      cancelUrl,
    });

    // Save session ID to order
    await conn.query('UPDATE orders SET flatpay_session_id = ? WHERE id = ?', [sessionId, orderId]);

    // Log order event
    await conn.query(
      'INSERT INTO order_events (order_id, event_type, new_status, message) VALUES (?,?,?,?)',
      [orderId, 'status_changed', 'pending_payment', `Ordre oprettet, Frisbii session ${sessionId}`]
    );

    // Increment discount code usage
    if (discountCodeId) {
      await conn.query('UPDATE discount_codes SET uses_count = uses_count + 1 WHERE id = ?', [discountCodeId]);
    }

    // Release reservation for this session
    if (session_token) {
      await conn.query('DELETE FROM stock_reservations WHERE session_token = ?', [session_token]);
    }

    await conn.commit();
    conn.release();

    res.status(201).json({
      order_token: token,
      order_number: orderNumber,
      frisbii_session_id: sessionId,
      total_ore: totalOre,
    });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('POST /shop/orders:', err.message);
    res.status(500).json({ error: 'Kunne ikke oprette ordre. Prøv igen.' });
  }
});

// ─── GET /shop/search ────────────────────────────────────────────────────────
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 12 } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json({ products: [] });
    }
    const pageSize = Math.min(50, parseInt(limit) || 12);
    const [products] = await pool.query(`
      SELECT p.id, p.name, p.slug, p.short_desc, p.price_ore, p.compare_ore,
             c.slug AS category_slug,
             (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) AS primary_image
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE p.is_active = 1
        AND MATCH(p.name, p.short_desc) AGAINST(? IN BOOLEAN MODE)
      ORDER BY p.is_featured DESC, p.created_at DESC
      LIMIT ?
    `, [q.trim() + '*', pageSize]);

    res.json({ products });
  } catch (err) {
    console.error('GET /shop/search:', err.message);
    res.status(500).json({ error: 'Søgning fejlede' });
  }
});

// ─── POST /shop/cart/reserve ─────────────────────────────────────────────────
router.post('/cart/reserve', orderRateLimiter, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { items, session_token } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      conn.release();
      return res.status(400).json({ error: 'Ingen varer at reservere' });
    }
    if (!session_token || typeof session_token !== 'string' || session_token.length < 8) {
      conn.release();
      return res.status(400).json({ error: 'session_token mangler' });
    }

    await conn.beginTransaction();

    const expiry = new Date(Date.now() + 15 * 60 * 1000);

    await conn.query('DELETE FROM stock_reservations WHERE expires_at < NOW()');
    await conn.query('DELETE FROM stock_reservations WHERE session_token = ?', [session_token]);

    const outOfStock = [];

    for (const item of items) {
      const pid = parseInt(item.product_id);
      const vid = item.variant_id ? parseInt(item.variant_id) : null;
      const qty = Math.max(1, Math.min(99, parseInt(item.quantity) || 1));

      const [[product]] = await conn.query(
        'SELECT id, stock, track_stock FROM products WHERE id = ? AND is_active = 1',
        [pid]
      );
      if (!product || !product.track_stock) continue;

      let stockField = product.stock;
      if (vid) {
        const [[variant]] = await conn.query(
          'SELECT stock FROM product_variants WHERE id = ? AND product_id = ? AND is_active = 1',
          [vid, pid]
        );
        if (variant) stockField = variant.stock;
      }

      const [[{ reserved }]] = await conn.query(
        `SELECT COALESCE(SUM(quantity), 0) AS reserved
         FROM stock_reservations
         WHERE product_id = ? AND expires_at > NOW()
           AND (? IS NULL AND variant_id IS NULL OR variant_id = ?)`,
        [pid, vid, vid]
      );

      const available = stockField - Number(reserved);
      if (available < qty) {
        outOfStock.push({ product_id: pid, variant_id: vid, available, requested: qty });
        continue;
      }

      await conn.query(
        'INSERT INTO stock_reservations (product_id, variant_id, quantity, session_token, expires_at) VALUES (?,?,?,?,?)',
        [pid, vid, qty, session_token, expiry]
      );
    }

    if (outOfStock.length > 0) {
      await conn.rollback();
      conn.release();
      return res.status(409).json({
        error: 'En eller flere varer er ikke tilgængelige i den ønskede mængde',
        out_of_stock: outOfStock,
      });
    }

    await conn.commit();
    conn.release();

    res.json({ ok: true, expires_at: expiry.toISOString(), session_token });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('POST /shop/cart/reserve:', err.message);
    res.status(500).json({ error: 'Reservation fejlede' });
  }
});

// ─── GET /shop/orders/:token ─────────────────────────────────────────────────
router.get('/orders/:token', async (req, res) => {
  try {
    if (!/^[a-f0-9]{64}$/.test(req.params.token)) {
      return res.status(404).json({ error: 'Ordre ikke fundet' });
    }

    const [[order]] = await pool.query(`
      SELECT o.*, sm.name AS shipping_method_name
      FROM orders o
      LEFT JOIN shipping_methods sm ON o.shipping_method_id = sm.id
      WHERE o.token = ?
    `, [req.params.token]);

    if (!order) return res.status(404).json({ error: 'Ordre ikke fundet' });

    const [items] = await pool.query(
      'SELECT * FROM order_items WHERE order_id = ?',
      [order.id]
    );

    // Strip internal IDs from public response
    const { flatpay_session_id, flatpay_charge_id, customer_id, ...publicOrder } = order;

    res.json({ ...publicOrder, items });
  } catch (err) {
    console.error('GET /shop/orders/:token:', err.message);
    res.status(500).json({ error: 'Kunne ikke hente ordre' });
  }
});

// ─── CUSTOMER AUTH ───────────────────────────────────────────────────────────

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: 'For mange forsøg. Prøv igen om 15 minutter.' }),
});

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function getCustomerFromSession(req) {
  const header = req.headers['x-customer-session'] || req.headers['authorization'];
  const token = header ? header.replace(/^Bearer\s+/i, '') : null;
  if (!token) return null;
  const [[session]] = await pool.query(
    'SELECT cs.*, c.id AS customer_id, c.email, c.first_name, c.last_name FROM customer_sessions cs JOIN customers c ON cs.customer_id = c.id WHERE cs.token = ? AND cs.expires_at > NOW()',
    [token]
  );
  return session || null;
}

// POST /shop/auth/register
router.post('/auth/register', authRateLimiter, async (req, res) => {
  try {
    const { email, password, first_name, last_name } = req.body;
    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({ error: 'Alle felter er påkrævet' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Adgangskode skal være mindst 8 tegn' });
    }
    const emailNorm = email.trim().toLowerCase();

    const [[existing]] = await pool.query('SELECT id FROM customers WHERE email = ?', [emailNorm]);
    if (existing) {
      return res.status(409).json({ error: 'En konto med denne e-mail eksisterer allerede' });
    }

    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      `INSERT INTO customers (email, first_name, last_name, password_hash) VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), first_name = VALUES(first_name), last_name = VALUES(last_name)`,
      [emailNorm, first_name.trim(), last_name.trim(), hash]
    );

    const customerId = result.insertId || existing?.id;
    const token = generateSessionToken();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO customer_sessions (customer_id, token, expires_at) VALUES (?,?,?)',
      [customerId, token, expires]
    );

    res.status(201).json({ session_token: token, expires_at: expires.toISOString(), email: emailNorm, first_name: first_name.trim() });
  } catch (err) {
    console.error('POST /shop/auth/register:', err.message);
    res.status(500).json({ error: 'Registrering fejlede' });
  }
});

// POST /shop/auth/login
router.post('/auth/login', authRateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'E-mail og adgangskode er påkrævet' });

    const emailNorm = email.trim().toLowerCase();
    const [[customer]] = await pool.query(
      'SELECT id, email, first_name, last_name, password_hash FROM customers WHERE email = ?',
      [emailNorm]
    );

    if (!customer || !customer.password_hash) {
      return res.status(401).json({ error: 'Forkert e-mail eller adgangskode' });
    }

    const valid = await bcrypt.compare(password, customer.password_hash);
    if (!valid) return res.status(401).json({ error: 'Forkert e-mail eller adgangskode' });

    const token = generateSessionToken();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO customer_sessions (customer_id, token, expires_at) VALUES (?,?,?)',
      [customer.id, token, expires]
    );

    res.json({ session_token: token, expires_at: expires.toISOString(), email: customer.email, first_name: customer.first_name });
  } catch (err) {
    console.error('POST /shop/auth/login:', err.message);
    res.status(500).json({ error: 'Login fejlede' });
  }
});

// POST /shop/auth/logout
router.post('/auth/logout', async (req, res) => {
  try {
    const header = req.headers['x-customer-session'] || req.headers['authorization'];
    const token = header ? header.replace(/^Bearer\s+/i, '') : null;
    if (token) await pool.query('DELETE FROM customer_sessions WHERE token = ?', [token]);
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /shop/auth/logout:', err.message);
    res.status(500).json({ error: 'Logout fejlede' });
  }
});

// GET /shop/auth/me
router.get('/auth/me', async (req, res) => {
  try {
    const session = await getCustomerFromSession(req);
    if (!session) return res.status(401).json({ error: 'Ikke logget ind' });
    res.json({ email: session.email, first_name: session.first_name, last_name: session.last_name });
  } catch (err) {
    console.error('GET /shop/auth/me:', err.message);
    res.status(500).json({ error: 'Sessionscheck fejlede' });
  }
});

// GET /shop/orders/my
router.get('/orders/my', async (req, res) => {
  try {
    const session = await getCustomerFromSession(req);
    if (!session) return res.status(401).json({ error: 'Log ind for at se dine ordrer' });

    const [orders] = await pool.query(`
      SELECT id, order_number, status, total_ore, created_at, ship_first_name, ship_last_name, token
      FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50
    `, [session.customer_id]);

    res.json({ orders });
  } catch (err) {
    console.error('GET /shop/orders/my:', err.message);
    res.status(500).json({ error: 'Kunne ikke hente ordrer' });
  }
});

module.exports = router;
