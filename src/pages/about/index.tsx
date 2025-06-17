// import { FaArrowLeft, FaArrowRight } from "react-icons/fa";

import "./about.scss";
import { AboutUsHeroSection, AboutUpumi, OurEfforts, Executives, Subscribe, FooterForOtherPages } from "../../components";
// import { chooseList } from './data';

const About = () => {
  return (
    <main className="about">
      < AboutUsHeroSection />
      < AboutUpumi />
      < OurEfforts />
      < Executives />
      <Subscribe />
      <FooterForOtherPages />
    </main>
  );
};

export default About;
