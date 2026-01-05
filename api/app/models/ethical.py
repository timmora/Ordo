"""Ethical and ESG flag model.

These flags enable hard exclusions (e.g., "no fossil fuels") and 
soft preferences (e.g., "minimize defense exposure").

Note: ESG data is imperfect. We document our sources and assumptions
clearly. Users should understand this is best-effort classification.
"""

from sqlalchemy import Column, Integer, Float, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from app.database import Base


class EthicalFlag(Base):
    """
    Ethical/ESG exposure flags for each asset.
    
    Values are 0.0 to 1.0, representing percentage of revenue
    from that activity. Binary flags use 0.0 or 1.0.
    
    Sources:
    - Sustainalytics (if available)
    - Manual research from company 10-K filings
    - Industry classification heuristics
    """
    __tablename__ = "ethical_flags"
    
    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False, unique=True, index=True)
    
    # Ethical exposure flags (0.0 to 1.0)
    
    # Fossil fuels: Oil, gas, coal extraction and processing
    # Source: Revenue from hydrocarbon operations
    fossil_fuel = Column(Float, default=0.0)
    
    # Defense/weapons: Military contracts, weapons manufacturing
    # Source: Revenue from defense contracts
    defense = Column(Float, default=0.0)
    
    # Gambling: Casinos, sports betting, lottery
    # Source: Revenue from gambling operations
    gambling = Column(Float, default=0.0)
    
    # Tobacco: Cigarettes, vaping, nicotine products
    # Source: Revenue from tobacco products
    tobacco = Column(Float, default=0.0)
    
    # Alcohol: Beer, wine, spirits production
    # Source: Revenue from alcohol products
    alcohol = Column(Float, default=0.0)
    
    # Private prisons: Incarceration services
    # Source: Revenue from detention facilities
    private_prisons = Column(Float, default=0.0)
    
    # Adult entertainment
    # Source: Revenue from adult content
    adult_entertainment = Column(Float, default=0.0)
    
    # Controversial weapons: Cluster munitions, landmines, etc.
    # Source: Any involvement (binary)
    controversial_weapons = Column(Float, default=0.0)
    
    # Relationships
    asset = relationship("Asset", back_populates="ethical_flags")
    
    # Ensure flags are valid percentages
    __table_args__ = (
        CheckConstraint("fossil_fuel >= 0 AND fossil_fuel <= 1", name="check_fossil_fuel_range"),
        CheckConstraint("defense >= 0 AND defense <= 1", name="check_defense_range"),
        CheckConstraint("gambling >= 0 AND gambling <= 1", name="check_gambling_range"),
        CheckConstraint("tobacco >= 0 AND tobacco <= 1", name="check_tobacco_range"),
        CheckConstraint("alcohol >= 0 AND alcohol <= 1", name="check_alcohol_range"),
        CheckConstraint("private_prisons >= 0 AND private_prisons <= 1", name="check_private_prisons_range"),
        CheckConstraint("adult_entertainment >= 0 AND adult_entertainment <= 1", name="check_adult_ent_range"),
        CheckConstraint("controversial_weapons >= 0 AND controversial_weapons <= 1", name="check_controversial_weapons_range"),
    )
    
    def to_dict(self) -> dict[str, float]:
        """Return flags as a dictionary for filtering."""
        return {
            "fossil_fuel": self.fossil_fuel,
            "defense": self.defense,
            "gambling": self.gambling,
            "tobacco": self.tobacco,
            "alcohol": self.alcohol,
            "private_prisons": self.private_prisons,
            "adult_entertainment": self.adult_entertainment,
            "controversial_weapons": self.controversial_weapons,
        }
    
    def __repr__(self):
        return f"<EthicalFlag for asset {self.asset_id}>"


# List of all ethical flag columns for iteration
ETHICAL_COLUMNS = [
    "fossil_fuel",
    "defense",
    "gambling",
    "tobacco",
    "alcohol",
    "private_prisons",
    "adult_entertainment",
    "controversial_weapons",
]
