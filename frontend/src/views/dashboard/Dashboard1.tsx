import Customer from "../../components/dashboards/Dashboard1/Customer"
import CustomerChart from "../../components/dashboards/Dashboard1/CustomerChart"
import Project from "../../components/dashboards/Dashboard1/Project"
import RevenueByProduct from "../../components/dashboards/Dashboard1/RevenueByProduct"
import RevenueForcast from "../../components/dashboards/Dashboard1/RevenueForcast"
import SalesOverview from "../../components/dashboards/Dashboard1/SalesOverview"
import TotalSettelment from "../../components/dashboards/Dashboard1/TotalSettelment"
import WelcomeBox from "../../components/dashboards/Dashboard1/WelcomeBox"
import YourPerformance from "../../components/dashboards/Dashboard1/YourPerformance"
import AuthDebugger from "../../components/AuthDebugger"

 const Dashboard1 = () => {
    return (
        <>
        <div className="grid grid-cols-12 gap-30">
          <div className="lg:col-span-5 col-span-12">
            <WelcomeBox />
            <div className="grid grid-cols-12 mt-30 gap-30">
              <div className="md:col-span-6 col-span-12">
                <Customer />
              </div>
              <div className="md:col-span-6 col-span-12">
                <Project />
              </div>
            </div>
          </div>
          <div className="lg:col-span-7 col-span-12">
            <RevenueForcast />
          </div>
          <div className="lg:col-span-5 col-span-12">
            <YourPerformance />
          </div>
          <div className="lg:col-span-7 col-span-12">
            <div className="grid grid-cols-12 gap-30">
              <div className="md:col-span-6 col-span-12">
                <CustomerChart />
              </div>
              <div className="md:col-span-6 col-span-12">
                <SalesOverview />
              </div>
            </div>
          </div>
          <div className="lg:col-span-8 col-span-12">
            <RevenueByProduct />
          </div>
          <div className="lg:col-span-4 col-span-12">
            <TotalSettelment />
          </div>
        </div>
        <AuthDebugger />
      </>
    )
}

export default Dashboard1;