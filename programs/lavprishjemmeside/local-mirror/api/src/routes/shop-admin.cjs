'use strict';

/**
 * Admin shop endpoints — JWT required.
 * Mounted at /shop/admin in server.cjs.
 */

const express = require('express');
const multer = require('multer');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { sendShippingNotification, sendRefundConfirmation } = require('../services/shop-email.cjs');
const { sendEmail } = require('../services/email');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const router = express.Router();

// All admin shop routes require authentication
router.use(requireAuth);

// ─── PRODUCTS ────────────────────────────────────────────────────────────────

// GET /shop/admin/products
router.get('/products', async (req, res) => {
  try {
    const { page = 1, limit = 50, search, category, active } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit) || 50);
    const pageSize = Math.min(100, parseInt(limit) || 50);

    let where = [];
    const params = [];

    if (search) {
      where.push('(p.name LIKE ? OR p.sku LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (category) {
      where.push('p.category_id = ?');
      params.push(parseInt(category));
    }
    if (active !== undefined) {
      where.push('p.is_active = ?');
      params.push(active === '1' || active === 'true' ? 1 : 0);
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [products] = await pool.query(`
      SELECT p.*, c.name AS category_name,
             (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) AS primary_image,
             (SELECT COUNT(*) FROM product_variants WHERE product_id = p.id) AS variant_count
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, pageSize, offset]);

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM products p ${whereClause}`,
      params
    );

    res.json({ products, total, page: parseInt(page), limit: pageSize });
  } catch (err) {
    console.error('GET /shop/admin/products:', err.message);
    res.status(500).json({ error: 'Kunne ikke hente produkter' });
  }
});

// POST /shop/admin/products
router.post('/products', async (req, res) => {
  try {
    const {
      category_id, name, slug, description, short_desc,
      price_ore, compare_ore, sku, stock, track_stock,
      is_active, is_featured, weight_g, meta_title, meta_desc, vat_rate,
    } = req.body;

    if (!name || !slug) return res.status(400).json({ error: 'Navn og slug er påkrævet' });
    if (price_ore == null || isNaN(parseInt(price_ore))) return res.status(400).json({ error: 'Pris er påkrævet' });

    const [result] = await pool.query(`
      INSERT INTO products
        (category_id, name, slug, description, short_desc, price_ore, compare_ore, vat_rate, sku,
         stock, track_stock, is_active, is_featured, weight_g, meta_title, meta_desc)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      category_id || null, name, slug, description || null, short_desc || null,
      parseInt(price_ore), compare_ore ? parseInt(compare_ore) : null,
      vat_rate ? parseFloat(vat_rate) : 0.25,
      sku || null, parseInt(stock) || 0,
      track_stock !== false && track_stock !== '0' ? 1 : 0,
      is_active !== false && is_active !== '0' ? 1 : 0,
      is_featured ? 1 : 0, weight_g ? parseInt(weight_g) : null,
      meta_title || null, meta_desc || null,
    ]);

    res.status(201).json({ id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Slug er allerede i brug' });
    console.error('POST /shop/admin/products:', err.message);
    res.status(500).json({ error: 'Kunne ikke oprette produkt' });
  }
});

// PUT /shop/admin/products/:id
router.put('/products/:id', async (req, res) => {
  try {
    const {
      category_id, name, slug, description, short_desc,
      price_ore, compare_ore, sku, stock, track_stock,
      is_active, is_featured, weight_g, meta_title, meta_desc, vat_rate,
    } = req.body;

    await pool.query(`
      UPDATE products SET
        category_id=?, name=?, slug=?, description=?, short_desc=?,
        price_ore=?, compare_ore=?, vat_rate=?, sku=?,
        stock=?, track_stock=?, is_active=?, is_featured=?,
        weight_g=?, meta_title=?, meta_desc=?, updated_at=NOW()
      WHERE id=?
    `, [
      category_id || null, name, slug, description || null, short_desc || null,
      parseInt(price_ore), compare_ore ? parseInt(compare_ore) : null,
      vat_rate ? parseFloat(vat_rate) : 0.25,
      sku || null, parseInt(stock) || 0,
      track_stock !== false && track_stock !== '0' ? 1 : 0,
      is_active !== false && is_active !== '0' ? 1 : 0,
      is_featured ? 1 : 0, weight_g ? parseInt(weight_g) : null,
      meta_title || null, meta_desc || null,
      parseInt(req.params.id),
    ]);

    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Slug er allerede i brug' });
    console.error('PUT /shop/admin/products/:id:', err.message);
    res.status(500).json({ error: 'Kunne ikke opdatere produkt' });
  }
});

// DELETE /shop/admin/products/:id
router.delete('/products/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /shop/admin/products/:id:', err.message);
    res.status(500).json({ error: 'Kunne ikke slette produkt' });
  }
});

// GET /shop/admin/products/:id — full product with variants + images
router.get('/products/:id', async (req, res) => {
  try {
    const [[product]] = await pool.query(
      'SELECT p.*, c.name AS category_name FROM products p LEFT JOIN product_categories c ON p.category_id = c.id WHERE p.id = ?',
      [parseInt(req.params.id)]
    );
    if (!product) return res.status(404).json({ error: 'Produkt ikke fundet' });

    const [variants] = await pool.query(
      'SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order',
      [product.id]
    );
    const [images] = await pool.query(
      'SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order',
      [product.id]
    );

    res.json({ ...product, variants, images });
  } catch (err) {
    console.error('GET /shop/admin/products/:id:', err.message);
    res.status(500).json({ error: 'Kunne ikke hente produkt' });
  }
});

// ─── VARIANTS ────────────────────────────────────────────────────────────────

// POST /shop/admin/products/:id/variants
router.post('/products/:id/variants', async (req, res) => {
  try {
    const { name, sku, price_ore, stock, sort_order, is_active } = req.body;
    if (!name) return res.status(400).json({ error: 'Navn er påkrævet' });

    const [result] = await pool.query(`
      INSERT INTO product_variants (product_id, name, sku, price_ore, stock, sort_order, is_active)
      VALUES (?,?,?,?,?,?,?)
    `, [
      parseInt(req.params.id), name, sku || null,
      price_ore != null ? parseInt(price_ore) : null,
      parseInt(stock) || 0,
      parseInt(sort_order) || 0,
      is_active !== false && is_active !== '0' ? 1 : 0,
    ]);

    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error('POST /shop/admin/products/:id/variants:', err.message);
    res.status(500).json({ error: 'Kunne ikke oprette variant' });
  }
});

// PUT /shop/admin/variants/:id
router.put('/variants/:id', async (req, res) => {
  try {
    const { name, sku, price_ore, stock, sort_order, is_active } = req.body;
    await pool.query(`
      UPDATE product_variants SET name=?, sku=?, price_ore=?, stock=?, sort_order=?, is_active=?
      WHERE id=?
    `, [
      name, sku || null,
      price_ore != null ? parseInt(price_ore) : null,
      parseInt(stock) || 0,
      parseInt(sort_order) || 0,
      is_active !== false && is_active !== '0' ? 1 : 0,
      parseInt(req.params.id),
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /shop/admin/variants/:id:', err.message);
    res.status(500).json({ error: 'Kunne ikke opdatere variant' });
  }
});

// DELETE /shop/admin/variants/:id
router.delete('/variants/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM product_variants WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /shop/admin/variants/:id:', err.message);
    res.status(500).json({ error: 'Kunne ikke slette variant' });
  }
});

// POST /shop/admin/products/:id/images
router.post('/products/:id/images', async (req, res) => {
  try {
    const { url, alt, sort_order, is_primary } = req.body;
    if (!url) return res.status(400).json({ error: 'URL er påkrævet' });

    const pid = parseInt(req.params.id);
    if (is_primary) {
      await pool.query('UPDATE product_images SET is_primary = 0 WHERE product_id = ?', [pid]);
    }
    const [result] = await pool.query(
      'INSERT INTO product_images (product_id, url, alt, sort_order, is_primary) VALUES (?,?,?,?,?)',
      [pid, url, alt || null, parseInt(sort_order) || 0, is_primary ? 1 : 0]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error('POST /shop/admin/products/:id/images:', err.message);
    res.status(500).json({ error: 'Kunne ikke tilføje billede' });
  }
});

// DELETE /shop/admin/images/:id
router.delete('/images/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM product_images WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /shop/admin/images/:id:', err.message);
    res.status(500).json({ error: 'Kunne ikke slette billede' });
  }
});

// ─── CATEGORIES ──────────────────────────────────────────────────────────────

router.get('/categories', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM product_categories ORDER BY sort_order, name');
    res.json(rows);
  } catch (err) {
    console.error('GET /shop/admin/categories:', err.message);
    res.status(500).json({ error: 'Kunne ikke hente kategorier' });
  }
});

router.post('/categories', async (req, res) => {
  try {
    const { parent_id, name, slug, description, image_url, sort_order, is_active } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'Navn og slug er påkrævet' });

    const [result] = await pool.query(
      'INSERT INTO product_categories (parent_id, name, slug, description, image_url, sort_order, is_active) VALUES (?,?,?,?,?,?,?)',
      [parent_id || null, name, slug, description || null, image_url || null, parseInt(sort_order) || 0, is_active !== false ? 1 : 0]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Slug er allerede i brug' });
    console.error('POST /shop/admin/categories:', err.message);
    res.status(500).json({ error: 'Kunne ikke oprette kategori' });
  }
});

router.put('/categories/:id', async (req, res) => {
  try {
    const { parent_id, name, slug, description, image_url, sort_order, is_active } = req.body;
    await pool.query(
      'UPDATE product_categories SET parent_id=?, name=?, slug=?, description=?, image_url=?, sort_order=?, is_active=?, updated_at=NOW() WHERE id=?',
      [parent_id || null, name, slug, description || null, image_url || null, parseInt(sort_order) || 0, is_active !== false ? 1 : 0, parseInt(req.params.id)]
    );
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Slug er allerede i brug' });
    console.error('PUT /shop/admin/categories/:id:', err.message);
    res.status(500).json({ error: 'Kunne ikke opdatere kategori' });
  }
});

router.delete('/categories/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM product_categories WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /shop/admin/categories/:id:', err.message);
    res.status(500).json({ error: 'Kunne ikke slette kategori' });
  }
});

// ─── ORDERS ──────────────────────────────────────────────────────────────────

router.get('/orders', async (req, res) => {
  try {
    const { page = 1, limit = 50, status, search } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit) || 50);
    const pageSize = Math.min(100, parseInt(limit) || 50);

    let where = [];
    const params = [];

    if (status) {
      where.push('o.status = ?');
      params.push(status);
    }
    if (search) {
      where.push('(o.order_number LIKE ? OR o.ship_email LIKE ? OR o.ship_last_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [orders] = await pool.query(`
      SELECT o.id, o.order_number, o.token, o.status, o.total_ore, o.currency,
             o.ship_first_name, o.ship_last_name, o.ship_email,
             o.shipping_name, o.paid_at, o.shipped_at, o.created_at
      FROM orders o
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, pageSize, offset]);

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM orders o ${whereClause}`,
      params
    );

    res.json({ orders, total, page: parseInt(page), limit: pageSize });
  } catch (err) {
    console.error('GET /shop/admin/orders:', err.message);
    res.status(500).json({ error: 'Kunne ikke hente ordrer' });
  }
});

router.get('/orders/:id', async (req, res) => {
  try {
    const [[order]] = await pool.query(
      'SELECT o.*, sm.name AS shipping_method_name FROM orders o LEFT JOIN shipping_methods sm ON o.shipping_method_id = sm.id WHERE o.id = ?',
      [parseInt(req.params.id)]
    );
    if (!order) return res.status(404).json({ error: 'Ordre ikke fundet' });

    const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    const [events] = await pool.query('SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at DESC', [order.id]);

    res.json({ ...order, items, events });
  } catch (err) {
    console.error('GET /shop/admin/orders/:id:', err.message);
    res.status(500).json({ error: 'Kunne ikke hente ordre' });
  }
});

// POST /shop/admin/orders/:id/status
router.post('/orders/:id/status', async (req, res) => {
  try {
    const { status, note } = req.body;
    const validStatuses = ['pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Ugyldig status' });
    }

    const [[order]] = await pool.query('SELECT * FROM orders WHERE id = ?', [parseInt(req.params.id)]);
    if (!order) return res.status(404).json({ error: 'Ordre ikke fundet' });

    const updates = { status, updated_at: new Date() };
    if (status === 'shipped' && !order.shipped_at) updates.shipped_at = new Date();
    if (status === 'paid' && !order.paid_at) updates.paid_at = new Date();

    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    await pool.query(
      `UPDATE orders SET ${setClauses} WHERE id = ?`,
      [...Object.values(updates), order.id]
    );

    await pool.query(
      'INSERT INTO order_events (order_id, event_type, old_status, new_status, message) VALUES (?,?,?,?,?)',
      [order.id, 'status_changed', order.status, status, note || null]
    );

    // Send shipping email
    if (status === 'shipped' && order.ship_email) {
      const siteUrl = 'https://lavprishjemmeside.dk';
      sendShippingNotification({ order: { ...order, status: 'shipped', ...updates }, siteUrl })
        .catch((e) => console.error('Shipping notification email failed:', e.message));

      await pool.query(
        'INSERT INTO order_events (order_id, event_type, message) VALUES (?,?,?)',
        [order.id, 'email_sent', 'Forsendelsesnotifikation sendt til kunde']
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /shop/admin/orders/:id/status:', err.message);
    res.status(500).json({ error: 'Kunne ikke opdatere status' });
  }
});

// POST /shop/admin/orders/:id/tracking
router.post('/orders/:id/tracking', async (req, res) => {
  try {
    const { tracking_number, tracking_carrier } = req.body;
    await pool.query(
      'UPDATE orders SET tracking_number = ?, tracking_carrier = ?, updated_at = NOW() WHERE id = ?',
      [tracking_number || null, tracking_carrier || null, parseInt(req.params.id)]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /shop/admin/orders/:id/tracking:', err.message);
    res.status(500).json({ error: 'Kunne ikke opdatere sporings-id' });
  }
});

// ─── SHIPPING METHODS ─────────────────────────────────────────────────────────

router.get('/shipping', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM shipping_methods ORDER BY sort_order');
    res.json(rows);
  } catch (err) {
    console.error('GET /shop/admin/shipping:', err.message);
    res.status(500).json({ error: 'Kunne ikke hente forsendelsesmetoder' });
  }
});

router.post('/shipping', async (req, res) => {
  try {
    const { name, carrier, price_ore, free_above_ore, est_days_min, est_days_max, is_active, sort_order, countries } = req.body;
    if (!name) return res.status(400).json({ error: 'Navn er påkrævet' });
    const countriesJson = Array.isArray(countries) && countries.length > 0 ? JSON.stringify(countries) : null;
    const [result] = await pool.query(
      'INSERT INTO shipping_methods (name, carrier, price_ore, free_above_ore, est_days_min, est_days_max, is_active, sort_order, countries) VALUES (?,?,?,?,?,?,?,?,?)',
      [name, carrier || null, parseInt(price_ore) || 0, free_above_ore ? parseInt(free_above_ore) : null,
       parseInt(est_days_min) || 1, parseInt(est_days_max) || 5, is_active !== false ? 1 : 0, parseInt(sort_order) || 0, countriesJson]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error('POST /shop/admin/shipping:', err.message);
    res.status(500).json({ error: 'Kunne ikke oprette forsendelsesmetode' });
  }
});

router.put('/shipping/:id', async (req, res) => {
  try {
    const { name, carrier, price_ore, free_above_ore, est_days_min, est_days_max, is_active, sort_order, countries } = req.body;
    const countriesJson = Array.isArray(countries) && countries.length > 0 ? JSON.stringify(countries) : null;
    await pool.query(
      'UPDATE shipping_methods SET name=?, carrier=?, price_ore=?, free_above_ore=?, est_days_min=?, est_days_max=?, is_active=?, sort_order=?, countries=? WHERE id=?',
      [name, carrier || null, parseInt(price_ore) || 0, free_above_ore ? parseInt(free_above_ore) : null,
       parseInt(est_days_min) || 1, parseInt(est_days_max) || 5, is_active !== false ? 1 : 0,
       parseInt(sort_order) || 0, countriesJson, parseInt(req.params.id)]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /shop/admin/shipping/:id:', err.message);
    res.status(500).json({ error: 'Kunne ikke opdatere forsendelsesmetode' });
  }
});

router.delete('/shipping/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM shipping_methods WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /shop/admin/shipping/:id:', err.message);
    res.status(500).json({ error: 'Kunne ikke slette forsendelsesmetode' });
  }
});

// ─── DISCOUNT CODES ───────────────────────────────────────────────────────────

router.get('/discounts', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM discount_codes ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('GET /shop/admin/discounts:', err.message);
    res.status(500).json({ error: 'Kunne ikke hente rabatkoder' });
  }
});

router.post('/discounts', async (req, res) => {
  try {
    const { code, type, value, min_order_ore, max_uses, valid_from, valid_to, is_active } = req.body;
    if (!code || !type || value == null) return res.status(400).json({ error: 'Kode, type og værdi er påkrævet' });

    const [result] = await pool.query(
      'INSERT INTO discount_codes (code, type, value, min_order_ore, max_uses, valid_from, valid_to, is_active) VALUES (?,?,?,?,?,?,?,?)',
      [code.trim().toUpperCase(), type, parseFloat(value), parseInt(min_order_ore) || 0,
       max_uses ? parseInt(max_uses) : null, valid_from || null, valid_to || null, is_active !== false ? 1 : 0]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Kode er allerede i brug' });
    console.error('POST /shop/admin/discounts:', err.message);
    res.status(500).json({ error: 'Kunne ikke oprette rabatkode' });
  }
});

router.put('/discounts/:id', async (req, res) => {
  try {
    const { code, type, value, min_order_ore, max_uses, valid_from, valid_to, is_active } = req.body;
    await pool.query(
      'UPDATE discount_codes SET code=?, type=?, value=?, min_order_ore=?, max_uses=?, valid_from=?, valid_to=?, is_active=? WHERE id=?',
      [code.trim().toUpperCase(), type, parseFloat(value), parseInt(min_order_ore) || 0,
       max_uses ? parseInt(max_uses) : null, valid_from || null, valid_to || null,
       is_active !== false ? 1 : 0, parseInt(req.params.id)]
    );
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Kode er allerede i brug' });
    console.error('PUT /shop/admin/discounts/:id:', err.message);
    res.status(500).json({ error: 'Kunne ikke opdatere rabatkode' });
  }
});

router.delete('/discounts/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM discount_codes WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /shop/admin/discounts/:id:', err.message);
    res.status(500).json({ error: 'Kunne ikke slette rabatkode' });
  }
});

// ─── SETTINGS ────────────────────────────────────────────────────────────────

router.get('/settings', async (req, res) => {
  try {
    const [[settings]] = await pool.query('SELECT * FROM shop_settings WHERE id = 1');
    if (!settings) return res.json({});

    // Mask encrypted keys — never expose actual values to frontend
    const safe = { ...settings };
    if (safe.flatpay_api_key_encrypted) safe.flatpay_api_key_encrypted = '••••••••';
    if (safe.flatpay_webhook_secret_encrypted) safe.flatpay_webhook_secret_encrypted = '••••••••';

    res.json(safe);
  } catch (err) {
    console.error('GET /shop/admin/settings:', err.message);
    res.status(500).json({ error: 'Kunne ikke hente indstillinger' });
  }
});

router.post('/settings', async (req, res) => {
  try {
    const {
      shop_name, shop_email, cvr_number,
      flatpay_api_key, flatpay_webhook_secret, flatpay_test_mode,
      notify_admin_email, send_customer_confirmation, send_shipping_notification,
    } = req.body;

    const updates = [];
    const params = [];

    if (shop_name !== undefined) { updates.push('shop_name = ?'); params.push(shop_name); }
    if (shop_email !== undefined) { updates.push('shop_email = ?'); params.push(shop_email); }
    if (cvr_number !== undefined) { updates.push('cvr_number = ?'); params.push(cvr_number); }
    if (flatpay_test_mode !== undefined) { updates.push('flatpay_test_mode = ?'); params.push(flatpay_test_mode ? 1 : 0); }
    if (notify_admin_email !== undefined) { updates.push('notify_admin_email = ?'); params.push(notify_admin_email); }
    if (send_customer_confirmation !== undefined) { updates.push('send_customer_confirmation = ?'); params.push(send_customer_confirmation ? 1 : 0); }
    if (send_shipping_notification !== undefined) { updates.push('send_shipping_notification = ?'); params.push(send_shipping_notification ? 1 : 0); }

    // Only update encrypted fields if new (non-masked) values provided
    if (flatpay_api_key && !flatpay_api_key.includes('•')) {
      updates.push('flatpay_api_key_encrypted = ?');
      params.push(flatpay_api_key);
    }
    if (flatpay_webhook_secret && !flatpay_webhook_secret.includes('•')) {
      updates.push('flatpay_webhook_secret_encrypted = ?');
      params.push(flatpay_webhook_secret);
    }

    if (updates.length === 0) return res.json({ ok: true });

    updates.push('updated_at = NOW()');
    await pool.query(
      `UPDATE shop_settings SET ${updates.join(', ')} WHERE id = 1`,
      params
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /shop/admin/settings:', err.message);
    res.status(500).json({ error: 'Kunne ikke gemme indstillinger' });
  }
});

// ─── REFUND ───────────────────────────────────────────────────────────────────

// POST /shop/admin/orders/:id/refund
router.post('/orders/:id/refund', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { reason, restore_stock, line_items } = req.body;
    const orderId = parseInt(req.params.id);

    const [[order]] = await conn.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      conn.release();
      return res.status(404).json({ error: 'Ordre ikke fundet' });
    }

    const refundableStatuses = ['paid', 'processing', 'shipped', 'delivered'];
    if (!refundableStatuses.includes(order.status)) {
      conn.release();
      return res.status(400).json({ error: `Ordre kan ikke refunderes med status "${order.status}"` });
    }

    await conn.beginTransaction();

    // Restore stock for specified line items if requested
    const itemsRefunded = [];
    if (restore_stock && Array.isArray(line_items) && line_items.length > 0) {
      for (const li of line_items) {
        const itemId = parseInt(li.order_item_id);
        const refundQty = Math.max(1, parseInt(li.quantity) || 1);

        const [[item]] = await conn.query(
          'SELECT * FROM order_items WHERE id = ? AND order_id = ?',
          [itemId, orderId]
        );
        if (!item) continue;

        if (item.variant_id) {
          await conn.query(
            'UPDATE product_variants SET stock = stock + ? WHERE id = ?',
            [refundQty, item.variant_id]
          );
        } else if (item.product_id) {
          await conn.query(
            'UPDATE products SET stock = stock + ? WHERE id = ? AND track_stock = 1',
            [refundQty, item.product_id]
          );
        }
        itemsRefunded.push({ order_item_id: itemId, quantity: refundQty, product_name: item.product_name });
      }
    }

    // Update order status
    await conn.query(
      'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
      ['refunded', orderId]
    );

    // Record audit event
    await conn.query(
      `INSERT INTO order_events (order_id, event_type, old_status, new_status, message)
       VALUES (?, 'refund_processed', ?, 'refunded', ?)`,
      [orderId, order.status, JSON.stringify({ reason: reason || null, items_refunded: itemsRefunded, stock_restored: !!restore_stock })]
    );

    await conn.commit();
    conn.release();

    // Send refund confirmation email (best-effort)
    if (order.ship_email) {
      const siteUrl = process.env.FLATPAY_ACCEPT_URL
        ? process.env.FLATPAY_ACCEPT_URL.replace('/shop/ordre', '')
        : 'https://lavprishjemmeside.dk';
      sendRefundConfirmation({ order: { ...order, status: 'refunded' }, reason, siteUrl })
        .catch((e) => console.error('Refund confirmation email failed:', e.message));

      await pool.query(
        'INSERT INTO order_events (order_id, event_type, message) VALUES (?,?,?)',
        [orderId, 'email_sent', 'Refunderingsbekræftelse sendt til kunde']
      );
    }

    // Trigger back-in-stock notifications for restored products (best-effort)
    if (restore_stock && itemsRefunded.length > 0) {
      const siteUrl = process.env.FLATPAY_ACCEPT_URL
        ? process.env.FLATPAY_ACCEPT_URL.replace('/shop/ordre', '')
        : 'https://lavprishjemmeside.dk';
      for (const refundedItem of itemsRefunded) {
        const [[item]] = await pool.query('SELECT product_id, variant_id FROM order_items WHERE id = ?', [refundedItem.order_item_id]).catch(() => [[]]);
        if (!item) continue;
        const [[productInfo]] = await pool.query('SELECT name, slug FROM products WHERE id = ?', [item.product_id]).catch(() => [[]]);
        if (!productInfo) continue;

        const [notifications] = await pool.query(
          'SELECT id, email FROM stock_notifications WHERE product_id = ? AND (variant_id IS NULL OR variant_id = ?) AND notified_at IS NULL',
          [item.product_id, item.variant_id || null]
        );
        for (const notif of notifications) {
          sendEmail({
            to: notif.email,
            subject: `${productInfo.name} er tilbage på lager`,
            html: `<p>Godt nyt! <strong>${productInfo.name}</strong> er nu tilbage på lager.</p><p><a href="${siteUrl}/shop/produkt/${productInfo.slug}/">Køb nu →</a></p><p>Hilsen Lavprishjemmeside.dk</p>`,
            text: `${productInfo.name} er nu tilbage på lager.\n\nKøb her: ${siteUrl}/shop/produkt/${productInfo.slug}/`,
          }).catch((e) => console.error('Back-in-stock email failed:', e.message));
          pool.query('UPDATE stock_notifications SET notified_at = NOW() WHERE id = ?', [notif.id]).catch(() => {});
        }
      }
    }

    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('POST /shop/admin/orders/:id/refund:', err.message);
    res.status(500).json({ error: 'Refundering fejlede' });
  }
});

// ─── ORDER NOTES ──────────────────────────────────────────────────────────────

// POST /shop/admin/orders/:id/note
router.post('/orders/:id/note', async (req, res) => {
  try {
    const { note } = req.body;
    const orderId = parseInt(req.params.id);

    if (!note || !note.trim()) {
      return res.status(400).json({ error: 'Note må ikke være tom' });
    }

    const [[order]] = await pool.query('SELECT id FROM orders WHERE id = ?', [orderId]);
    if (!order) return res.status(404).json({ error: 'Ordre ikke fundet' });

    await pool.query(
      `INSERT INTO order_events (order_id, event_type, message) VALUES (?, 'internal_note', ?)`,
      [orderId, note.trim().substring(0, 2000)]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /shop/admin/orders/:id/note:', err.message);
    res.status(500).json({ error: 'Kunne ikke gemme note' });
  }
});

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

router.get('/dashboard', async (req, res) => {
  try {
    const [[revenue]] = await pool.query(`
      SELECT
        SUM(CASE WHEN status IN ('paid','processing','shipped','delivered') THEN total_ore ELSE 0 END) AS total_revenue_ore,
        SUM(CASE WHEN status IN ('paid','processing','shipped','delivered') AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN total_ore ELSE 0 END) AS revenue_30d_ore,
        COUNT(*) AS total_orders,
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS orders_30d,
        SUM(CASE WHEN status = 'pending_payment' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'paid' OR status = 'processing' THEN 1 ELSE 0 END) AS to_ship
      FROM orders
    `);

    const [recentOrders] = await pool.query(`
      SELECT id, order_number, status, total_ore, ship_first_name, ship_last_name, created_at
      FROM orders ORDER BY created_at DESC LIMIT 10
    `);

    const [topProducts] = await pool.query(`
      SELECT oi.product_name, SUM(oi.quantity) AS qty_sold, SUM(oi.total_price_ore) AS revenue_ore
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status IN ('paid','processing','shipped','delivered')
      GROUP BY oi.product_name
      ORDER BY qty_sold DESC
      LIMIT 5
    `);

    const [lowStock] = await pool.query(`
      SELECT id, name, slug, stock FROM products
      WHERE track_stock = 1 AND is_active = 1 AND stock <= 5
      ORDER BY stock ASC
      LIMIT 10
    `);

    const [dailyOrders] = await pool.query(`
      SELECT DATE(created_at) AS day, COUNT(*) AS count
      FROM orders
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `);

    res.json({ revenue, recent_orders: recentOrders, top_products: topProducts, low_stock: lowStock, daily_orders: dailyOrders });
  } catch (err) {
    console.error('GET /shop/admin/dashboard:', err.message);
    res.status(500).json({ error: 'Kunne ikke hente dashboard' });
  }
});

// ─── PRODUCT REVIEWS ─────────────────────────────────────────────────────────

// GET /shop/admin/reviews
router.get('/reviews', async (req, res) => {
  try {
    const { approved, page = 1 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * 50;
    let where = [];
    const params = [];
    if (approved !== undefined) { where.push('pr.approved = ?'); params.push(approved === '1' ? 1 : 0); }
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const [reviews] = await pool.query(`
      SELECT pr.*, p.name AS product_name, p.slug AS product_slug
      FROM product_reviews pr
      JOIN products p ON pr.product_id = p.id
      ${whereClause}
      ORDER BY pr.created_at DESC LIMIT 50 OFFSET ?
    `, [...params, offset]);
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM product_reviews pr ${whereClause}`, params);
    res.json({ reviews, total });
  } catch (err) {
    console.error('GET /shop/admin/reviews:', err.message);
    res.status(500).json({ error: 'Kunne ikke hente anmeldelser' });
  }
});

// PUT /shop/admin/reviews/:id/approve
router.put('/reviews/:id/approve', async (req, res) => {
  try {
    const { approved } = req.body;
    await pool.query('UPDATE product_reviews SET approved = ? WHERE id = ?', [approved !== false ? 1 : 0, parseInt(req.params.id)]);
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /shop/admin/reviews/:id/approve:', err.message);
    res.status(500).json({ error: 'Kunne ikke opdatere anmeldelse' });
  }
});

// DELETE /shop/admin/reviews/:id
router.delete('/reviews/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM product_reviews WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /shop/admin/reviews/:id:', err.message);
    res.status(500).json({ error: 'Kunne ikke slette anmeldelse' });
  }
});

// ─── ABANDONED CART RECOVERY ─────────────────────────────────────────────────

// GET /shop/admin/cron/abandoned-carts — safe to call from cPanel cron job
router.get('/cron/abandoned-carts', async (req, res) => {
  try {
    const siteUrl = process.env.FLATPAY_ACCEPT_URL
      ? process.env.FLATPAY_ACCEPT_URL.replace('/shop/ordre', '')
      : 'https://lavprishjemmeside.dk';

    const [carts] = await pool.query(`
      SELECT * FROM cart_sessions
      WHERE email IS NOT NULL
        AND recovered_at IS NULL
        AND reminder_sent_at IS NULL
        AND last_activity_at < DATE_SUB(NOW(), INTERVAL 2 HOUR)
        AND captured_at IS NOT NULL
      LIMIT 50
    `);

    let sent = 0;
    for (const cart of carts) {
      try {
        let cartItems = [];
        try { cartItems = JSON.parse(cart.cart_json); } catch {}
        const itemList = Array.isArray(cartItems)
          ? cartItems.map(i => `${i.name || i.product_name || 'Vare'} × ${i.quantity || 1}`).join(', ')
          : 'Dine varer';

        await sendEmail({
          to: cart.email,
          subject: 'Du har glemt noget i din indkøbskurv',
          html: `<p>Hej,</p><p>Du har varer liggende i din kurv på Lavprishjemmeside.dk:</p><p>${itemList}</p><p><a href="${siteUrl}/shop/kurv/">Gå til kurven →</a></p><p>Hilsen Lavprishjemmeside.dk</p>`,
          text: `Du har glemt varer i din kurv: ${itemList}\n\nGå til kurven: ${siteUrl}/shop/kurv/`,
        });

        await pool.query('UPDATE cart_sessions SET reminder_sent_at = NOW() WHERE id = ?', [cart.id]);
        sent++;
      } catch (mailErr) {
        console.error('Abandoned cart email failed for cart', cart.id, mailErr.message);
      }
    }

    res.json({ ok: true, processed: carts.length, sent });
  } catch (err) {
    console.error('GET /shop/admin/cron/abandoned-carts:', err.message);
    res.status(500).json({ error: 'Cron fejlede' });
  }
});

// ─── BULK PRODUCT IMPORT / EXPORT ────────────────────────────────────────────

// GET /shop/admin/products/export.csv
router.get('/products/export.csv', async (req, res) => {
  try {
    const [products] = await pool.query(`
      SELECT p.sku, p.name, p.slug, p.short_desc, p.price_ore, p.compare_ore,
             p.vat_rate, p.stock, p.track_stock, p.is_active, p.is_featured,
             p.weight_g, p.meta_title, p.meta_desc, c.slug AS category_slug
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      ORDER BY p.created_at DESC
    `);

    const headers = ['sku','name','slug','short_desc','price_ore','compare_ore','vat_rate','stock','track_stock','is_active','is_featured','weight_g','meta_title','meta_desc','category_slug'];

    function escCsv(v) {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    }

    const rows = [
      headers.join(','),
      ...products.map(p => headers.map(h => escCsv(p[h])).join(',')),
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="products-export.csv"');
    res.send('\uFEFF' + rows.join('\r\n'));
  } catch (err) {
    console.error('GET /shop/admin/products/export.csv:', err.message);
    res.status(500).json({ error: 'Eksport fejlede' });
  }
});

// POST /shop/admin/products/import
router.post('/products/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Ingen fil uploadet' });

    const text = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return res.status(400).json({ error: 'Filen er tom eller har ingen rækker' });

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const required = ['sku', 'name', 'slug', 'price_ore'];
    for (const r of required) {
      if (!headers.includes(r)) return res.status(400).json({ error: `Manglende kolonne: ${r}` });
    }

    function parseCsvRow(line) {
      const vals = [];
      let cur = '', inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuote && line[i+1] === '"') { cur += '"'; i++; }
          else inQuote = !inQuote;
        } else if (ch === ',' && !inQuote) {
          vals.push(cur); cur = '';
        } else cur += ch;
      }
      vals.push(cur);
      return vals;
    }

    let upserted = 0, skipped = 0, errors = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const vals = parseCsvRow(lines[i]);
        const row = {};
        headers.forEach((h, idx) => { row[h] = vals[idx] !== undefined ? vals[idx].trim() : ''; });

        if (!row.sku || !row.name || !row.slug) { skipped++; continue; }

        const priceOre = parseInt(row.price_ore);
        if (isNaN(priceOre) || priceOre < 0) { skipped++; continue; }

        let categoryId = null;
        if (row.category_slug) {
          const [[cat]] = await pool.query('SELECT id FROM product_categories WHERE slug = ?', [row.category_slug]);
          if (cat) categoryId = cat.id;
        }

        await pool.query(`
          INSERT INTO products (sku, name, slug, short_desc, price_ore, compare_ore, vat_rate, stock, track_stock, is_active, is_featured, weight_g, meta_title, meta_desc, category_id)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON DUPLICATE KEY UPDATE
            name=VALUES(name), short_desc=VALUES(short_desc), price_ore=VALUES(price_ore),
            compare_ore=VALUES(compare_ore), stock=VALUES(stock), track_stock=VALUES(track_stock),
            is_active=VALUES(is_active), is_featured=VALUES(is_featured), category_id=VALUES(category_id),
            meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc), updated_at=NOW()
        `, [
          row.sku, row.name, row.slug, row.short_desc || null,
          priceOre, row.compare_ore ? parseInt(row.compare_ore) : null,
          row.vat_rate ? parseFloat(row.vat_rate) : 0.25,
          row.stock ? parseInt(row.stock) : 0,
          row.track_stock === '0' ? 0 : 1,
          row.is_active === '0' ? 0 : 1,
          row.is_featured === '1' ? 1 : 0,
          row.weight_g ? parseInt(row.weight_g) : null,
          row.meta_title || null, row.meta_desc || null, categoryId,
        ]);
        upserted++;
      } catch (rowErr) {
        errors.push({ row: i + 1, error: rowErr.message });
      }
    }

    res.json({ ok: true, upserted, skipped, errors });
  } catch (err) {
    console.error('POST /shop/admin/products/import:', err.message);
    res.status(500).json({ error: 'Import fejlede' });
  }
});

// ─── EMAIL TEMPLATES ──────────────────────────────────────────────────────────

// GET /shop/admin/emails
router.get('/emails', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, slug, label, subject, updated_at FROM email_templates ORDER BY slug');
    res.json(rows);
  } catch (err) {
    console.error('GET /shop/admin/emails:', err.message);
    res.status(500).json({ error: 'Kunne ikke hente e-mailskabeloner' });
  }
});

// GET /shop/admin/emails/:slug
router.get('/emails/:slug', async (req, res) => {
  try {
    const [[row]] = await pool.query('SELECT * FROM email_templates WHERE slug = ?', [req.params.slug]);
    if (!row) return res.status(404).json({ error: 'Skabelon ikke fundet' });
    res.json(row);
  } catch (err) {
    console.error('GET /shop/admin/emails/:slug:', err.message);
    res.status(500).json({ error: 'Kunne ikke hente skabelon' });
  }
});

// PUT /shop/admin/emails/:slug
router.put('/emails/:slug', async (req, res) => {
  try {
    const { subject, html_body, label } = req.body;
    if (!subject || !html_body) return res.status(400).json({ error: 'Emne og HTML-indhold er påkrævet' });

    const [[existing]] = await pool.query('SELECT id FROM email_templates WHERE slug = ?', [req.params.slug]);
    if (existing) {
      await pool.query(
        'UPDATE email_templates SET subject=?, html_body=?, label=?, updated_at=NOW() WHERE slug=?',
        [subject, html_body, label || subject, req.params.slug]
      );
    } else {
      await pool.query(
        'INSERT INTO email_templates (slug, label, subject, html_body) VALUES (?,?,?,?)',
        [req.params.slug, label || subject, subject, html_body]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /shop/admin/emails/:slug:', err.message);
    res.status(500).json({ error: 'Kunne ikke gemme skabelon' });
  }
});

module.exports = router;
