const BOOKING_KEY = 'salon_bookings';

function readBookings() {
  try {
    const raw = localStorage.getItem(BOOKING_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeBookings(bookings) {
  localStorage.setItem(BOOKING_KEY, JSON.stringify(bookings));
}

export function saveBooking(booking) {
  const bookings = readBookings();
  const id = 'BK-' + Date.now().toString(36).toUpperCase();
  const full = { ...booking, id, created_at: new Date().toISOString(), status: 'confirmed' };
  bookings.push(full);
  writeBookings(bookings);
  return full;
}

export function getAllBookings() {
  return readBookings();
}

export function getBookingsForDate(date) {
  return readBookings().filter(b => b.date === date);
}

export function cancelBooking(id) {
  const bookings = readBookings().map(b => b.id === id ? { ...b, status: 'cancelled' } : b);
  writeBookings(bookings);
}

export function isSlotTaken(date, time, staffId) {
  return readBookings().some(b => b.date === date && b.time === time && b.staffId === staffId && b.status !== 'cancelled');
}

export function generateTimeSlots(startHour, endHour, durationMinutes) {
  const slots = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += durationMinutes) {
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      slots.push(`${hh}:${mm}`);
    }
  }
  return slots;
}

export function formatPrice(ore) {
  return (ore / 100).toLocaleString('da-DK', { style: 'currency', currency: 'DKK', minimumFractionDigits: 0 });
}

export function getDaysInMonth(year, month) {
  const days = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}
