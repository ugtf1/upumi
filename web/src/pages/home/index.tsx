
import "./home.scss";
import {
  Hero,
  LatestEvents,
  UpcomingEvents,
  EmpoweringEfforts,
   Footer,
   FooterForOtherPages,
  
} from "../../components";
// import { useEffect, useState } from "react";

const Home = () => {
  // const [isVisible, setIsVisible] = useState(true);


  // useEffect(() => {
  //   const timer = setTimeout(() => {
  //     setIsVisible(false);
  //   }, 9000);
  //   return () => clearTimeout(timer);
  // }, []);


  return (
    <main className="home">
      {/* { isVisible &&
        <Dialog  closeModal={setIsVisible}/>
      } */}
      <Hero />
      <LatestEvents />
      <UpcomingEvents />
      <EmpoweringEfforts />
      <Footer />
      <FooterForOtherPages />
    </main>
  );
};

export default Home;
