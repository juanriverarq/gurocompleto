import { FC } from "react";
import GuroLoader from "../../components/GuroLoader";

const Spinner: FC = () => (
  <GuroLoader fullScreen size={100} />
);
export default Spinner;
