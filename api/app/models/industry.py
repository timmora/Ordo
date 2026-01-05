"""Industry weight model.

Key insight: Companies are multi-industry. Apple isn't just "tech" - it's
~80% tech, ~15% consumer electronics, ~5% services. This granularity 
enables precise constraint satisfaction.
"""

from sqlalchemy import Column, Integer, Float, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from app.database import Base


class IndustryWeight(Base):
    """
    Industry exposure percentages for each asset.
    
    All weights for a single asset should sum to 1.0.
    This is validated at data load time, not by database constraints.
    """
    __tablename__ = "industry_weights"
    
    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False, index=True)
    
    # Industry weights (0.0 to 1.0)
    # These should sum to 1.0 per asset
    tech = Column(Float, default=0.0)
    healthcare = Column(Float, default=0.0)
    financials = Column(Float, default=0.0)
    energy = Column(Float, default=0.0)
    consumer_discretionary = Column(Float, default=0.0)
    consumer_staples = Column(Float, default=0.0)
    industrials = Column(Float, default=0.0)
    materials = Column(Float, default=0.0)
    utilities = Column(Float, default=0.0)
    real_estate = Column(Float, default=0.0)
    communication = Column(Float, default=0.0)
    
    # Relationships
    asset = relationship("Asset", back_populates="industry_weights")
    
    # Ensure weights are valid percentages
    __table_args__ = (
        CheckConstraint("tech >= 0 AND tech <= 1", name="check_tech_range"),
        CheckConstraint("healthcare >= 0 AND healthcare <= 1", name="check_healthcare_range"),
        CheckConstraint("financials >= 0 AND financials <= 1", name="check_financials_range"),
        CheckConstraint("energy >= 0 AND energy <= 1", name="check_energy_range"),
        CheckConstraint("consumer_discretionary >= 0 AND consumer_discretionary <= 1", name="check_consumer_disc_range"),
        CheckConstraint("consumer_staples >= 0 AND consumer_staples <= 1", name="check_consumer_staples_range"),
        CheckConstraint("industrials >= 0 AND industrials <= 1", name="check_industrials_range"),
        CheckConstraint("materials >= 0 AND materials <= 1", name="check_materials_range"),
        CheckConstraint("utilities >= 0 AND utilities <= 1", name="check_utilities_range"),
        CheckConstraint("real_estate >= 0 AND real_estate <= 1", name="check_real_estate_range"),
        CheckConstraint("communication >= 0 AND communication <= 1", name="check_communication_range"),
    )
    
    @property
    def total_weight(self) -> float:
        """Sum of all industry weights. Should equal 1.0."""
        return (
            self.tech + self.healthcare + self.financials + self.energy +
            self.consumer_discretionary + self.consumer_staples + self.industrials +
            self.materials + self.utilities + self.real_estate + self.communication
        )
    
    def to_dict(self) -> dict[str, float]:
        """Return weights as a dictionary for optimization."""
        return {
            "tech": self.tech,
            "healthcare": self.healthcare,
            "financials": self.financials,
            "energy": self.energy,
            "consumer_discretionary": self.consumer_discretionary,
            "consumer_staples": self.consumer_staples,
            "industrials": self.industrials,
            "materials": self.materials,
            "utilities": self.utilities,
            "real_estate": self.real_estate,
            "communication": self.communication,
        }
    
    def __repr__(self):
        return f"<IndustryWeight for asset {self.asset_id}>"


# List of all industry columns for iteration
INDUSTRY_COLUMNS = [
    "tech",
    "healthcare", 
    "financials",
    "energy",
    "consumer_discretionary",
    "consumer_staples",
    "industrials",
    "materials",
    "utilities",
    "real_estate",
    "communication",
]
