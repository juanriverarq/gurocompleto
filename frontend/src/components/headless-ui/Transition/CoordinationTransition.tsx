
import  { useContext,  } from "react";
import CardBox from "src/components/shared/CardBox";
import CoordinationCode from "./Codes/CoordinationCode";
import { DashboardContext } from "src/context/DashboardContext/DashboardContext";

const CoordinationTransition = () => {
  const {setIsSidebarOpen} = useContext(DashboardContext);
  return (
    <div>
      <CardBox>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-lg font-semibold">Coordinating Transition</h4>
          <CoordinationCode />
        </div>
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="ui-button bg-success justify-center"
        >
          Coordinating Transition
        </button>

      </CardBox>
    </div>
  );
};

export default CoordinationTransition;
