import React, { useState, useEffect, createContext, useContext } from 'react';
import axios from 'axios';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext();

// Auth Provider Component
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Verify token
      axios.get(`${API}/auth/me`)
        .then(response => {
          setUser(response.data);
        })
        .catch(() => {
          localStorage.removeItem('token');
          delete axios.defaults.headers.common['Authorization'];
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      const { access_token, user: userData } = response.data;
      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      setUser(userData);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Login failed' };
    }
  };

  const register = async (userData) => {
    try {
      await axios.post(`${API}/auth/register`, userData);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Registration failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const value = {
    user,
    login,
    register,
    logout,
    loading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth
const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Navigation Component
const Navigation = () => {
  const { user, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState('home');

  return (
    <nav className="bg-gradient-to-r from-purple-900 via-pink-700 to-amber-600 shadow-lg border-b-4 border-yellow-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-2xl font-bold text-white magical-text">🍄 Wonderland Stores</span>
            </div>
            <div className="hidden md:block ml-10">
              <div className="flex items-baseline space-x-4">
                <button 
                  onClick={() => setCurrentPage('home')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentPage === 'home' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  Home
                </button>
                <button 
                  onClick={() => setCurrentPage('products')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentPage === 'products' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  Overlays
                </button>
                {user && (
                  <>
                    <button 
                      onClick={() => setCurrentPage('dashboard')}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        currentPage === 'dashboard' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      My Account
                    </button>
                    <button 
                      onClick={() => setCurrentPage('suggestions')}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        currentPage === 'suggestions' ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      Suggest
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-4">
                <span className="text-white/90 text-sm">Welcome, {user.first_name}!</span>
                <button
                  onClick={logout}
                  className="bg-red-500/80 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage('login')}
                  className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Login
                </button>
                <button
                  onClick={() => setCurrentPage('register')}
                  className="bg-yellow-500 hover:bg-yellow-600 text-purple-900 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <PageContent currentPage={currentPage} setCurrentPage={setCurrentPage} />
    </nav>
  );
};

// Page Content Router
const PageContent = ({ currentPage, setCurrentPage }) => {
  switch (currentPage) {
    case 'home':
      return <HomePage setCurrentPage={setCurrentPage} />;
    case 'products':
      return <ProductsPage />;
    case 'login':
      return <LoginForm setCurrentPage={setCurrentPage} />;
    case 'register':
      return <RegisterForm setCurrentPage={setCurrentPage} />;
    case 'dashboard':
      return <Dashboard />;
    case 'suggestions':
      return <ProductSuggestions />;
    default:
      return <HomePage setCurrentPage={setCurrentPage} />;
  }
};

// Home Page Component
const HomePage = ({ setCurrentPage }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-amber-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-bold magical-text bg-gradient-to-r from-purple-600 via-pink-600 to-amber-600 bg-clip-text text-transparent mb-6">
              ✨ Welcome to Wonderland ✨
            </h1>
            <p className="text-xl md:text-2xl text-gray-700 mb-8 max-w-3xl mx-auto">
              Magical custom stream overlays that bring your streaming adventure to life! 
              Step into a world where cottage core meets Alice in Wonderland charm.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setCurrentPage('products')}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-4 rounded-full text-lg font-semibold transition-all transform hover:scale-105 shadow-lg"
              >
                🎨 Explore Overlays
              </button>
              <button
                onClick={() => setCurrentPage('suggestions')}
                className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white px-8 py-4 rounded-full text-lg font-semibold transition-all transform hover:scale-105 shadow-lg"
              >
                💡 Suggest Custom Design
              </button>
            </div>
          </div>
        </div>
        
        {/* Floating Elements */}
        <div className="absolute top-10 left-10 text-4xl animate-bounce">🍄</div>
        <div className="absolute top-20 right-20 text-3xl animate-pulse">🌸</div>
        <div className="absolute bottom-20 left-20 text-3xl animate-bounce delay-1000">🦋</div>
        <div className="absolute bottom-10 right-10 text-4xl animate-pulse delay-500">🌿</div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-800 mb-4">Why Choose Wonderland?</h2>
          <p className="text-xl text-gray-600">Crafted with love for the streaming community</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-white/30 hover:transform hover:scale-105 transition-all">
            <div className="text-6xl text-center mb-6">🎨</div>
            <h3 className="text-2xl font-bold text-center mb-4 text-purple-800">Unique Designs</h3>
            <p className="text-gray-700 text-center">Each overlay is lovingly crafted with whimsical cottage core and Alice in Wonderland aesthetics that make your stream truly magical.</p>
          </div>
          
          <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-white/30 hover:transform hover:scale-105 transition-all">
            <div className="text-6xl text-center mb-6">⚡</div>
            <h3 className="text-2xl font-bold text-center mb-4 text-purple-800">Stream Ready</h3>
            <p className="text-gray-700 text-center">Compatible with OBS, Streamlabs, and all major streaming software. Easy to set up and customize for your brand.</p>
          </div>
          
          <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-white/30 hover:transform hover:scale-105 transition-all">
            <div className="text-6xl text-center mb-6">💝</div>
            <h3 className="text-2xl font-bold text-center mb-4 text-purple-800">Custom Orders</h3>
            <p className="text-gray-700 text-center">Need something special? We create custom overlays tailored to your unique style and streaming needs, starting at just $15.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Products Page Component
const ProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      // Initialize sample data first
      await axios.post(`${API}/init-data`);
      // Then fetch products
      const response = await axios.get(`${API}/products`);
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product) => {
    if (!user) {
      alert('Please login to add items to cart!');
      return;
    }
    setCart([...cart, product]);
    alert(`${product.name} added to cart!`);
  };

  const checkout = async () => {
    if (!user) {
      alert('Please login to checkout!');
      return;
    }
    if (cart.length === 0) {
      alert('Your cart is empty!');
      return;
    }

    try {
      const orderData = {
        items: cart.map(item => ({ product_id: item.id, quantity: 1 }))
      };
      
      await axios.post(`${API}/orders`, orderData);
      alert('Order placed successfully! Check your account dashboard for details.');
      setCart([]);
    } catch (error) {
      console.error('Error creating order:', error);
      alert('Error placing order. Please try again.');
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-amber-50 flex items-center justify-center">
      <div className="text-2xl text-purple-600">Loading magical overlays... ✨</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-amber-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold magical-text bg-gradient-to-r from-purple-600 via-pink-600 to-amber-600 bg-clip-text text-transparent mb-4">
            ✨ Magical Stream Overlays ✨
          </h1>
          <p className="text-xl text-gray-700 max-w-3xl mx-auto">
            Transform your stream with our enchanting cottage core and whimsical overlays, 
            each designed to bring magic to your content creation journey.
          </p>
          {cart.length > 0 && (
            <div className="mt-6 bg-white/80 backdrop-blur-sm rounded-2xl p-4 max-w-md mx-auto">
              <p className="text-lg font-semibold text-purple-800">Cart: {cart.length} items</p>
              <button
                onClick={checkout}
                className="mt-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-6 py-2 rounded-full font-semibold transition-all"
              >
                Checkout ${cart.reduce((sum, item) => sum + item.price, 0).toFixed(2)}
              </button>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product) => (
            <div key={product.id} className="bg-white/80 backdrop-blur-sm rounded-3xl overflow-hidden shadow-xl border border-white/50 hover:transform hover:scale-105 transition-all duration-300">
              <div className="aspect-video bg-gradient-to-br from-purple-200 to-pink-200 flex items-center justify-center">
                <img 
                  src={product.image_url} 
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-xl font-bold text-purple-800">{product.name}</h3>
                  <span className="bg-gradient-to-r from-amber-400 to-yellow-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                    ${product.price}
                  </span>
                </div>
                <p className="text-gray-700 mb-4 text-sm leading-relaxed">{product.description}</p>
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">
                      {product.category}
                    </span>
                    <span className="bg-pink-100 text-pink-800 px-2 py-1 rounded-full text-xs font-medium">
                      {product.complexity}
                    </span>
                  </div>
                  <button
                    onClick={() => addToCart(product)}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-2 rounded-full text-sm font-semibold transition-all transform hover:scale-105"
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Login Form Component
const LoginForm = ({ setCurrentPage }) => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(formData.email, formData.password);
    if (result.success) {
      setCurrentPage('home');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-amber-50 flex items-center justify-center py-12">
      <div className="max-w-md w-full mx-auto">
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-8 border border-white/50">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold magical-text bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Welcome Back! ✨
            </h2>
            <p className="text-gray-600 mt-2">Enter your magical portal</p>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2">Email</label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2">Password</label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3 rounded-xl font-semibold transition-all transform hover:scale-105 disabled:opacity-50"
            >
              {loading ? 'Entering Wonderland...' : 'Login ✨'}
            </button>
          </form>

          <div className="text-center mt-6">
            <p className="text-gray-600">
              New to Wonderland?{' '}
              <button
                onClick={() => setCurrentPage('register')}
                className="text-purple-600 hover:text-purple-800 font-semibold"
              >
                Create Account
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Register Form Component
const RegisterForm = ({ setCurrentPage }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await register(formData);
    if (result.success) {
      alert('Account created successfully! Please login.');
      setCurrentPage('login');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-amber-50 flex items-center justify-center py-12">
      <div className="max-w-md w-full mx-auto">
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-8 border border-white/50">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold magical-text bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Join Wonderland! ✨
            </h2>
            <p className="text-gray-600 mt-2">Start your magical journey</p>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 text-sm font-semibold mb-2">First Name</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="Alice"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-semibold mb-2">Last Name</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Wonderland"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2">Email</label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="alice@wonderland.com"
              />
            </div>

            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2">Password</label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3 rounded-xl font-semibold transition-all transform hover:scale-105 disabled:opacity-50"
            >
              {loading ? 'Creating Account...' : 'Join Wonderland ✨'}
            </button>
          </form>

          <div className="text-center mt-6">
            <p className="text-gray-600">
              Already have an account?{' '}
              <button
                onClick={() => setCurrentPage('login')}
                className="text-purple-600 hover:text-purple-800 font-semibold"
              >
                Login
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Dashboard Component
const Dashboard = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API}/orders`);
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-amber-50 flex items-center justify-center">
      <div className="text-2xl text-purple-600">Loading your magical orders... ✨</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-amber-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold magical-text bg-gradient-to-r from-purple-600 via-pink-600 to-amber-600 bg-clip-text text-transparent mb-4">
            Your Wonderland Dashboard ✨
          </h1>
          <p className="text-xl text-gray-700">Welcome back, {user?.first_name}!</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Profile Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/50">
            <h2 className="text-2xl font-bold text-purple-800 mb-6">Profile Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-600 text-sm font-semibold">Name</label>
                <p className="text-lg text-gray-800">{user?.first_name} {user?.last_name}</p>
              </div>
              <div>
                <label className="block text-gray-600 text-sm font-semibold">Email</label>
                <p className="text-lg text-gray-800">{user?.email}</p>
              </div>
              <div>
                <label className="block text-gray-600 text-sm font-semibold">Member Since</label>
                <p className="text-lg text-gray-800">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Order Statistics */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/50">
            <h2 className="text-2xl font-bold text-purple-800 mb-6">Order Summary</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Orders</span>
                <span className="text-2xl font-bold text-purple-600">{orders.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Spent</span>
                <span className="text-2xl font-bold text-green-600">
                  ${orders.reduce((sum, order) => sum + order.total_amount, 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Recent Orders</span>
                <span className="text-2xl font-bold text-amber-600">
                  {orders.filter(order => {
                    const orderDate = new Date(order.created_at);
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    return orderDate > weekAgo;
                  }).length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Orders History */}
        <div className="mt-12">
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/50">
            <h2 className="text-2xl font-bold text-purple-800 mb-6">Order History</h2>
            {orders.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🛒</div>
                <p className="text-xl text-gray-600 mb-4">No orders yet!</p>
                <p className="text-gray-500">Start exploring our magical overlays to place your first order.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.slice().reverse().map((order) => (
                  <div key={order.id} className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-purple-800">Order #{order.id.slice(-8)}</h3>
                        <p className="text-gray-600">
                          {new Date(order.created_at).toLocaleDateString()} at {new Date(order.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-600">${order.total_amount.toFixed(2)}</p>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          order.status === 'completed' ? 'bg-green-100 text-green-800' :
                          order.status === 'paid' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Items ({order.items.length}):</h4>
                      <div className="flex flex-wrap gap-2">
                        {order.items.map((item, index) => (
                          <span key={index} className="bg-white/60 px-3 py-1 rounded-full text-sm text-purple-700">
                            Product ID: {item.product_id.slice(-8)} (Qty: {item.quantity})
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Product Suggestions Component
const ProductSuggestions = () => {
  const [formData, setFormData] = useState({
    suggestion_text: '',
    category: '',
    budget_range: ''
  });
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchSuggestions();
    }
  }, [user]);

  const fetchSuggestions = async () => {
    try {
      const response = await axios.get(`${API}/suggestions`);
      setSuggestions(response.data);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(`${API}/suggestions`, formData);
      alert('Suggestion submitted successfully! We\'ll get back to you soon with a custom design.');
      setFormData({ suggestion_text: '', category: '', budget_range: '' });
      fetchSuggestions();
    } catch (error) {
      console.error('Error submitting suggestion:', error);
      alert('Error submitting suggestion. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔐</div>
          <p className="text-2xl text-purple-600">Please login to suggest custom designs!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-amber-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold magical-text bg-gradient-to-r from-purple-600 via-pink-600 to-amber-600 bg-clip-text text-transparent mb-4">
            ✨ Suggest Custom Design ✨
          </h1>
          <p className="text-xl text-gray-700">
            Have a magical idea for a custom overlay? Share your vision with us!
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Suggestion Form */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/50">
            <h2 className="text-2xl font-bold text-purple-800 mb-6">Tell Us Your Vision</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-gray-700 text-sm font-semibold mb-2">
                  Describe Your Dream Overlay *
                </label>
                <textarea
                  required
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none"
                  value={formData.suggestion_text}
                  onChange={(e) => setFormData({ ...formData, suggestion_text: e.target.value })}
                  placeholder="I'd love a cosmic-themed overlay with floating stars and planets, featuring subscriber alerts and a dreamy chat box..."
                />
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-semibold mb-2">
                  Preferred Category
                </label>
                <select
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="">Select a category (optional)</option>
                  <option value="Cottage Core">Cottage Core</option>
                  <option value="Fantasy">Fantasy</option>
                  <option value="Seasonal">Seasonal</option>
                  <option value="Gaming">Gaming</option>
                  <option value="Minimalist">Minimalist</option>
                  <option value="Cosmic">Cosmic</option>
                  <option value="Halloween">Halloween</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-semibold mb-2">
                  Budget Range
                </label>
                <select
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  value={formData.budget_range}
                  onChange={(e) => setFormData({ ...formData, budget_range: e.target.value })}
                >
                  <option value="">Select budget range (optional)</option>
                  <option value="$15-$25">$15-$25 (Standard)</option>
                  <option value="$25-$50">$25-$50 (Complex)</option>
                  <option value="$50-$100">$50-$100 (Premium)</option>
                  <option value="$100+">$100+ (Ultimate Custom)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3 rounded-xl font-semibold transition-all transform hover:scale-105 disabled:opacity-50"
              >
                {loading ? 'Sending to Wonderland...' : 'Submit Suggestion ✨'}
              </button>
            </form>
          </div>

          {/* Previous Suggestions */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/50">
            <h2 className="text-2xl font-bold text-purple-800 mb-6">Your Suggestions</h2>
            {suggestions.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">💡</div>
                <p className="text-xl text-gray-600 mb-4">No suggestions yet!</p>
                <p className="text-gray-500">Share your first custom design idea with us.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {suggestions.slice().reverse().map((suggestion) => (
                  <div key={suggestion.id} className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm text-gray-600">
                        {new Date(suggestion.created_at).toLocaleDateString()}
                      </span>
                      {suggestion.category && (
                        <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">
                          {suggestion.category}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-800 mb-2">{suggestion.suggestion_text}</p>
                    {suggestion.budget_range && (
                      <div className="flex justify-end">
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                          {suggestion.budget_range}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Main App Component
function App() {
  return (
    <AuthProvider>
      <div className="App">
        <Navigation />
      </div>
    </AuthProvider>
  );
}

export default App;