import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { initialCars, initialBlogPosts, initialTestimonials, initialSiteSettings } from './src/data/initialData.js';
import { Car, Inquiry, BlogPost, Testimonial, SiteSettings } from './src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'taqwa_motors_super_secret_jwt_key_2026';

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// In-Memory Data Store (Initialized with rich sample data)
let carsStore: Car[] = [...initialCars];
let blogStore: BlogPost[] = [...initialBlogPosts];
let testimonialStore: Testimonial[] = [...initialTestimonials];
let siteSettingsStore: SiteSettings = { ...initialSiteSettings };
let inquiriesStore: Inquiry[] = [
  {
    id: 'inq-101',
    carId: 'car-001',
    carTitle: 'Toyota Land Cruiser Prado TX-L Package',
    name: 'Kabir Chowdhury',
    phone: '+880 1711-223344',
    email: 'kabir.c@gmail.com',
    message: 'Interested in seeing the original Japanese auction sheet for this Prado and scheduling a test drive this Saturday.',
    type: 'Test Drive',
    status: 'New',
    createdDate: '2026-08-01 14:30'
  },
  {
    id: 'inq-102',
    carId: 'car-003',
    carTitle: 'Mercedes-Benz E200 AMG Line Night Edition',
    name: 'Dr. Shahriar Alam',
    phone: '+880 1819-556677',
    email: 'dr.shahriar@hospital.org',
    message: 'Please send loan estimate details with 60% bank financing options.',
    type: 'Financing',
    status: 'In Progress',
    createdDate: '2026-07-30 10:15'
  }
];

// Admin password hash for 'taqwa2026'
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'taqwa2026', 10);

// Helper Admin Authentication Middleware
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token missing' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    (req as any).user = user;
    next();
  });
};

// ==================== REST API ROUTES ====================

// Auth: Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USERNAME && bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
    const token = jwt.sign({ username: ADMIN_USERNAME, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({
      success: true,
      token,
      user: { username: ADMIN_USERNAME, role: 'admin' }
    });
  }

  return res.status(401).json({ success: false, error: 'Invalid username or password' });
});

// Auth: Verify Token
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({ valid: true, user: (req as any).user });
});

// Cars API
app.get('/api/cars', (req, res) => {
  let filtered = [...carsStore];
  const { brand, bodyType, condition, fuelType, transmission, status, search } = req.query;

  if (brand && brand !== 'All') {
    filtered = filtered.filter(c => c.brand.toLowerCase() === (brand as string).toLowerCase());
  }
  if (bodyType && bodyType !== 'All') {
    filtered = filtered.filter(c => c.bodyType.toLowerCase() === (bodyType as string).toLowerCase());
  }
  if (condition && condition !== 'All') {
    filtered = filtered.filter(c => c.condition.toLowerCase().includes((condition as string).toLowerCase()));
  }
  if (fuelType && fuelType !== 'All') {
    filtered = filtered.filter(c => c.fuelType.toLowerCase() === (fuelType as string).toLowerCase());
  }
  if (transmission && transmission !== 'All') {
    filtered = filtered.filter(c => c.transmission.toLowerCase() === (transmission as string).toLowerCase());
  }
  if (status && status !== 'All') {
    filtered = filtered.filter(c => c.status.toLowerCase() === (status as string).toLowerCase());
  }
  if (search) {
    const q = (search as string).toLowerCase();
    filtered = filtered.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.brand.toLowerCase().includes(q) ||
      c.model.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q)
    );
  }

  res.json(filtered);
});

app.get('/api/cars/:id', (req, res) => {
  const car = carsStore.find(c => c.id === req.params.id);
  if (!car) return res.status(404).json({ error: 'Car not found' });
  res.json(car);
});

app.post('/api/cars', authenticateToken, (req, res) => {
  const carData: Car = req.body;
  const newCar: Car = {
    ...carData,
    id: `car-${Date.now()}`,
    createdDate: new Date().toISOString().split('T')[0],
    updatedDate: new Date().toISOString().split('T')[0]
  };
  carsStore.unshift(newCar);
  res.status(201).json(newCar);
});

app.put('/api/cars/:id', authenticateToken, (req, res) => {
  const index = carsStore.findIndex(c => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Car not found' });

  carsStore[index] = {
    ...carsStore[index],
    ...req.body,
    updatedDate: new Date().toISOString().split('T')[0]
  };
  res.json(carsStore[index]);
});

app.delete('/api/cars/:id', authenticateToken, (req, res) => {
  const index = carsStore.findIndex(c => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Car not found' });

  const deleted = carsStore.splice(index, 1);
  res.json({ success: true, deleted: deleted[0] });
});

// Inquiries API
app.get('/api/inquiries', authenticateToken, (req, res) => {
  res.json(inquiriesStore);
});

app.post('/api/inquiries', (req, res) => {
  const { name, phone, email, message, carId, carTitle, type } = req.body;
  if (!name || !phone || !email || !message) {
    return res.status(400).json({ error: 'Name, phone, email, and message are required fields.' });
  }

  const newInquiry: Inquiry = {
    id: `inq-${Date.now()}`,
    carId,
    carTitle,
    name,
    phone,
    email,
    message,
    type: type || 'General Inquiry',
    status: 'New',
    createdDate: new Date().toLocaleString()
  };

  inquiriesStore.unshift(newInquiry);
  res.status(201).json({ success: true, inquiry: newInquiry });
});

app.put('/api/inquiries/:id', authenticateToken, (req, res) => {
  const index = inquiriesStore.findIndex(i => i.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Inquiry not found' });

  inquiriesStore[index] = {
    ...inquiriesStore[index],
    status: req.body.status || inquiriesStore[index].status
  };
  res.json(inquiriesStore[index]);
});

app.delete('/api/inquiries/:id', authenticateToken, (req, res) => {
  inquiriesStore = inquiriesStore.filter(i => i.id !== req.params.id);
  res.json({ success: true });
});

// Blogs API
app.get('/api/blogs', (req, res) => {
  res.json(blogStore);
});

app.post('/api/blogs', authenticateToken, (req, res) => {
  const newPost: BlogPost = {
    ...req.body,
    id: `blog-${Date.now()}`,
    slug: req.body.title ? req.body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : `post-${Date.now()}`,
    publishDate: new Date().toISOString().split('T')[0]
  };
  blogStore.unshift(newPost);
  res.status(201).json(newPost);
});

app.put('/api/blogs/:id', authenticateToken, (req, res) => {
  const index = blogStore.findIndex(b => b.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Blog post not found' });

  blogStore[index] = { ...blogStore[index], ...req.body };
  res.json(blogStore[index]);
});

app.delete('/api/blogs/:id', authenticateToken, (req, res) => {
  blogStore = blogStore.filter(b => b.id !== req.params.id);
  res.json({ success: true });
});

// Testimonials API
app.get('/api/testimonials', (req, res) => {
  res.json(testimonialStore);
});

app.post('/api/testimonials', (req, res) => {
  const newTestimonial: Testimonial = {
    ...req.body,
    id: `testi-${Date.now()}`,
    date: new Date().toISOString().split('T')[0],
    verified: false
  };
  testimonialStore.unshift(newTestimonial);
  res.status(201).json(newTestimonial);
});

app.delete('/api/testimonials/:id', authenticateToken, (req, res) => {
  testimonialStore = testimonialStore.filter(t => t.id !== req.params.id);
  res.json({ success: true });
});

// Site Settings API
app.get('/api/settings', (req, res) => {
  res.json(siteSettingsStore);
});

app.put('/api/settings', authenticateToken, (req, res) => {
  siteSettingsStore = { ...siteSettingsStore, ...req.body };
  res.json(siteSettingsStore);
});

// Dashboard Stats API
app.get('/api/stats', authenticateToken, (req, res) => {
  const totalCars = carsStore.length;
  const availableCars = carsStore.filter(c => c.status === 'Available').length;
  const reservedCars = carsStore.filter(c => c.status === 'Reserved').length;
  const soldCars = carsStore.filter(c => c.status === 'Sold').length;
  const totalInquiries = inquiriesStore.length;
  const newInquiries = inquiriesStore.filter(i => i.status === 'New').length;

  res.json({
    totalCars,
    availableCars,
    reservedCars,
    soldCars,
    totalInquiries,
    newInquiries,
    totalBlogs: blogStore.length,
    totalTestimonials: testimonialStore.length,
    estimatedVisitors: 14820
  });
});

// Start Server Setup (Vite middleware in Dev, Static in Prod)
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Taqwa Motors] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
