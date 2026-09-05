from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import CatalogProduct


DEFAULT_PRODUCTS = [
    {
        "industry": "auto_parts",
        "name": "Brake Pad",
        "description": "High quality brake pad",
        "brand": "Bosch",
    },
    {
        "industry": "auto_parts",
        "name": "Oil Filter",
        "description": "Engine oil filter",
        "brand": "Mann",
    },
    {
        "industry": "auto_parts",
        "name": "Air Filter",
        "description": "Car air filter",
        "brand": "K&N",
    },
    {
        "industry": "auto_parts",
        "name": "Spark Plug",
        "description": "Standard spark plug",
        "brand": "NGK",
    },
]


def seed_catalog():
    db: Session = SessionLocal()

    for product in DEFAULT_PRODUCTS:
        exists = db.query(CatalogProduct).filter(
            CatalogProduct.name == product["name"]
        ).first()

        if not exists:
            db.add(CatalogProduct(**product))

    db.commit()
    db.close()


if __name__ == "__main__":
    seed_catalog()