from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import bcrypt
import jwt
from jwt.exceptions import InvalidTokenError
import stripe

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Stripe Configuration
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# JWT Configuration
SECRET_KEY = os.environ.get("JWT_SECRET", "wonderland-secret-key-2025")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

security = HTTPBearer()

# Define Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    password_hash: str
    first_name: str
    last_name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    created_at: datetime

class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    price: float
    image_url: str
    category: str
    complexity: str = "Standard"  # Standard, Complex, Premium
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ProductCreate(BaseModel):
    name: str
    description: str
    price: float
    image_url: str
    category: str
    complexity: str = "Standard"

class CartItem(BaseModel):
    product_id: str
    quantity: int = 1

class Order(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    items: List[CartItem]
    total_amount: float
    status: str = "pending"  # pending, paid, completed, cancelled
    stripe_payment_intent_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class OrderCreate(BaseModel):
    items: List[CartItem]

class ProductSuggestion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    suggestion_text: str
    category: Optional[str] = None
    budget_range: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ProductSuggestionCreate(BaseModel):
    suggestion_text: str
    category: Optional[str] = None
    budget_range: Optional[str] = None

class PaymentIntentCreate(BaseModel):
    amount: float
    currency: str = "usd"

class StripeCheckout(BaseModel):
    items: List[CartItem]

# Utility Functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except InvalidTokenError:
        raise credentials_exception
    
    user = await db.users.find_one({"email": email})
    if user is None:
        raise credentials_exception
    return User(**user)

# Root route
@api_router.get("/")
async def root():
    return {"message": "Welcome to Wonderland Stores API! ✨🍄"}

# Health check route
@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "message": "Wonderland API is running!"}

# Authentication Routes
@api_router.post("/auth/register", response_model=UserResponse)
async def register_user(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    hashed_password = hash_password(user_data.password)
    user = User(
        email=user_data.email,
        password_hash=hashed_password,
        first_name=user_data.first_name,
        last_name=user_data.last_name
    )
    
    await db.users.insert_one(user.dict())
    return UserResponse(**user.dict())

@api_router.post("/auth/login")
async def login_user(login_data: UserLogin):
    user = await db.users.find_one({"email": login_data.email})
    if not user or not verify_password(login_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["email"]}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "user": UserResponse(**user)}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return UserResponse(**current_user.dict())

# Product Routes
@api_router.get("/products", response_model=List[Product])
async def get_products():
    products = await db.products.find().to_list(1000)
    return [Product(**product) for product in products]

@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return Product(**product)

@api_router.post("/products", response_model=Product)
async def create_product(product_data: ProductCreate):
    product = Product(**product_data.dict())
    await db.products.insert_one(product.dict())
    return product

# Order Routes
@api_router.post("/orders", response_model=Order)
async def create_order(order_data: OrderCreate, current_user: User = Depends(get_current_user)):
    # Calculate total amount
    total_amount = 0
    for item in order_data.items:
        product = await db.products.find_one({"id": item.product_id})
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        total_amount += product["price"] * item.quantity
    
    order = Order(
        user_id=current_user.id,
        items=order_data.items,
        total_amount=total_amount
    )
    
    await db.orders.insert_one(order.dict())
    return order

@api_router.get("/orders", response_model=List[Order])
async def get_user_orders(current_user: User = Depends(get_current_user)):
    orders = await db.orders.find({"user_id": current_user.id}).to_list(1000)
    return [Order(**order) for order in orders]

@api_router.get("/orders/{order_id}", response_model=Order) 
async def get_order(order_id: str, current_user: User = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id, "user_id": current_user.id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return Order(**order)

# Product Suggestions Routes
@api_router.post("/suggestions", response_model=ProductSuggestion)
async def create_suggestion(suggestion_data: ProductSuggestionCreate, current_user: User = Depends(get_current_user)):
    suggestion = ProductSuggestion(
        user_id=current_user.id,
        **suggestion_data.dict()
    )
    await db.product_suggestions.insert_one(suggestion.dict())
    return suggestion

@api_router.get("/suggestions", response_model=List[ProductSuggestion])
async def get_user_suggestions(current_user: User = Depends(get_current_user)):
    suggestions = await db.product_suggestions.find({"user_id": current_user.id}).to_list(1000)
    return [ProductSuggestion(**suggestion) for suggestion in suggestions]

# Stripe Payment Routes
@api_router.post("/create-payment-intent")
async def create_payment_intent(checkout_data: StripeCheckout, current_user: User = Depends(get_current_user)):
    try:
        # Calculate total amount
        total_amount = 0
        for item in checkout_data.items:
            product = await db.products.find_one({"id": item.product_id})
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
            total_amount += product["price"] * item.quantity
        
        # Create payment intent with Stripe
        intent = stripe.PaymentIntent.create(
            amount=int(total_amount * 100),  # Stripe uses cents
            currency='usd',
            payment_method_types=['card'],
            metadata={
                'user_id': current_user.id,
                'user_email': current_user.email,
                'items': str(len(checkout_data.items))
            }
        )
        
        return {
            "client_secret": intent.client_secret,
            "amount": total_amount,
            "payment_intent_id": intent.id
        }
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

@api_router.post("/confirm-payment")
async def confirm_payment(payment_intent_id: str, items: List[CartItem], current_user: User = Depends(get_current_user)):
    try:
        # Verify payment with Stripe
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        
        if intent.status != 'succeeded':
            raise HTTPException(status_code=400, detail="Payment not successful")
        
        # Calculate total amount for verification
        total_amount = 0
        for item in items:
            product = await db.products.find_one({"id": item.product_id})
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
            total_amount += product["price"] * item.quantity
        
        # Create order record
        order = Order(
            user_id=current_user.id,
            items=items,
            total_amount=total_amount,
            status="paid",
            stripe_payment_intent_id=payment_intent_id
        )
        
        await db.orders.insert_one(order.dict())
        
        return {
            "success": True,
            "order_id": order.id,
            "message": "Payment successful! Your order has been placed."
        }
        
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

@api_router.get("/stripe-config")
async def get_stripe_config():
    return {
        "publishable_key": os.environ.get("STRIPE_PUBLISHABLE_KEY")
    }

# Initialize sample data
@api_router.post("/init-data")
async def initialize_sample_data():
    # Check if products already exist
    existing_products = await db.products.count_documents({})
    if existing_products > 0:
        return {"message": "Sample data already exists"}
    
    # Create sample products based on the overlay images
    sample_products = [
        Product(
            name="Floral Dream Overlay",
            description="Beautiful cottage core overlay with delicate florals and whimsical design. Perfect for cozy streaming sessions. Features latest followers, newest subscribers, and integrated chat display.",
            price=15.00,
            image_url="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZmxvcmFsR3JhZGllbnQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZmY5MmE4O3N0b3Atb3BhY2l0eToxIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjUwJSIgc3R5bGU9InN0b3AtY29sb3I6I2ZmYjNiYTtzdG9wLW9wYWNpdHk6MSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZjBmOWZmO3N0b3Atb3BhY2l0eToxIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNmbG9yYWxHcmFkaWVudCkiLz4KICA8dGV4dCB4PSI0MCIgeT0iNDAiIGZvbnQtZmFtaWx5PSJjdXJzaXZlIiBmb250LXNpemU9IjI0IiBmaWxsPSIjOGI1Y2Y2Ij5MYXRlc3QgRm9sbG93ZXI8L3RleHQ+CiAgPHRleHQgeD0iNjAwIiB5PSI0MCIgZm9udC1mYW1pbHk9ImN1cnNpdmUiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiM4YjVjZjYiPk5ld2VzdCBTdWI8L3RleHQ+CiAgPHJlY3QgeD0iNTAwIiB5PSIxMDAiIHdpZHRoPSIyODAiIGhlaWdodD0iNDgwIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuOSkiIHJ4PSIxNSIvPgogIDx0ZXh0IHg9IjUyMCIgeT0iMTMwIiBmb250LWZhbWlseT0iY3Vyc2l2ZSIgZm9udC1zaXplPSIyMCIgZmlsbD0iIzZkMjhkOSI+Q2hhdDwvdGV4dD4KPC9zdmc+", 
            category="Cottage Core",
            complexity="Standard"
        ),
        Product(
            name="Spooky Halloween Overlay",
            description="Enchanting Halloween stream overlay with mystical elements, perfect for October streams. Features spooky decorations, autumn colors, and ghostly charm. Includes subscriber alerts and chat integration.",
            price=20.00,
            image_url="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0ic3Bvb2t5R3JhZGllbnQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZmY2YzAwO3N0b3Atb3BhY2l0eToxIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjUwJSIgc3R5bGU9InN0b3AtY29sb3I6I2ZmOGYwMDtzdG9wLW9wYWNpdHk6MSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojMzMxYTAwO3N0b3Atb3BhY2l0eToxIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNzcG9va3lHcmFkaWVudCkiLz4KICA8cG9seWdvbiBwb2ludHM9IjUwLDEwMCA4MCw4MCA4MCwxMjAgNTAsMTQwIDIwLDEyMCAyMCw4MCIgZmlsbD0iIzMzMzMzMyIvPgogIDxjaXJjbGUgY3g9IjEwMCIgY3k9IjEwMCIgcj0iMjAiIGZpbGw9IiNmZjZjMDAiLz4KICA8dGV4dCB4PSI1MDAiIHk9IjUwIiBmb250LWZhbWlseT0iY3Vyc2l2ZSIgZm9udC1zaXplPSIyOCIgZmlsbD0iI2ZmZmZmZiI+Q2hhdDwvdGV4dD4KICA8cmVjdCB4PSI0NzAiIHk9IjgwIiB3aWR0aD0iMzEwIiBoZWlnaHQ9IjUwMCIgZmlsbD0icmdiYSgwLDAsMCwwLjgpIiByeD0iMTUiLz4KPC9zdmc+",
            category="Halloween",
            complexity="Complex"
        ),
        Product(
            name="Autumn Magic Overlay",
            description="Magical autumn-themed overlay with vibrant fall colors and mystical elements. Perfect for cozy autumn streaming sessions. Features animated leaves and warm seasonal vibes with all essential stream widgets.",
            price=25.00,
            image_url="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYXV0dW1uR3JhZGllbnQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZmY2ZDk5O3N0b3Atb3BhY2l0eToxIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjMzJSIgc3R5bGU9InN0b3AtY29sb3I6I2ZmYjM0NjtzdG9wLW9wYWNpdHk6MSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSI2NiUiIHN0eWxlPSJzdG9wLWNvbG9yOiNmZmU1MzU7c3RvcC1vcGFjaXR5OjEiIC8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6I2ZmOWEwMDtzdG9wLW9wYWNpdHk6MSIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjYXV0dW1uR3JhZGllbnQpIi8+CiAgPHRleHQgeD0iNDAiIHk9IjU1MCIgZm9udC1mYW1pbHk9ImN1cnNpdmUiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiNmZmZmZmYiPk5ld2VzdCBTdWI8L3RleHQ+CiAgPHRleHQgeD0iNDUwIiB5PSI1NTAiIGZvbnQtZmFtaWx5PSJjdXJzaXZlIiBmb250LXNpemU9IjI0IiBmaWxsPSIjZmZmZmZmIj5Ub3AgRG9uYXRvcjwvdGV4dD4KICA8Y2lyY2xlIGN4PSIxNTAiIGN5PSIxNTAiIHI9IjE1IiBmaWxsPSIjZmZlNTM1Ii8+CiAgPGNpcmNsZSBjeD0iNjUwIiBjeT0iMjAwIiByPSIyMCIgZmlsbD0iI2ZmOWEwMCIvPgogIDxjaXJjbGUgY3g9IjMwMCIgY3k9IjEwMCIgcj0iMTIiIGZpbGw9IiNmZjZkOTkiLz4KPC9zdmc+",
            category="Seasonal",
            complexity="Premium"
        )
    ]
    
    for product in sample_products:
        await db.products.insert_one(product.dict())
    
    return {"message": "Sample data initialized successfully"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],  
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()