from sqlalchemy import create_engine, Column, Integer, String, Float, Enum
from sqlalchemy.orm import declarative_base, sessionmaker
import enum

SQLALCHEMY_DATABASE_URL = "sqlite:///./camplx.db"

# check_same_thread=False is required for SQLite in FastAPI
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Step 3: Lifecycle Statuses explicitly mapped to the PPT
class LifecycleStatus(str, enum.Enum):
    PENDING = "pending"
    SCHEDULED = "scheduled"
    COLLECTED = "collected"
    HANDED_OVER = "handed_over"

class EWasteRequest(Base):
    __tablename__ = "ewaste_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, index=True)
    item_category = Column(String) # Reusable, Repairable, End-of-life
    quantity = Column(Integer)
    latitude = Column(Float)
    longitude = Column(Float)
    
    # Tracking variables
    status = Column(Enum(LifecycleStatus), default=LifecycleStatus.PENDING)
    zone_cluster_id = Column(Integer, nullable=True) # Assigned in Step 2
    pickup_sequence_order = Column(Integer, nullable=True) # Assigned in Step 2

# Create tables
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()