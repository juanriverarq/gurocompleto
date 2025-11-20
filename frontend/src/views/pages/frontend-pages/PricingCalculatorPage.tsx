import PricingCalculator from 'src/components/landingpage/pricing-calculator/PricingCalculator';
import PurchaseTemp from 'src/components/front-pages/homepage/PurchaseTemp';

const PricingCalculatorPage = () => {
  return (
    <>
      {/* Calculator Section */}
      <PricingCalculator />
      
      {/* CTA Section */}
      <div className="sm:pb-14 pb-8">
        <PurchaseTemp />
      </div>
    </>
  );
};

export default PricingCalculatorPage;
