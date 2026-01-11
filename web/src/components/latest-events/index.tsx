import { eventDetails } from "./data";
import Card from "../app-card";

import "./latest-events.scss";
const LatestEvents = () => {
  return (
    <section className="latestEvents">
      <div className="latestEventsHeading">
        <h2>Our Latest Events</h2>
        <p>Efforts embarked on by our community.</p>
      </div>
      <div className="latestEventsCards">
        {
          eventDetails.map(({img, title, desc})=>{
            return(
                <Card className='event-card'>
                  <img src={img} alt=""  className="card-image"/>
                  <h3 className="card-title">{title}</h3>
                  <p className="card-description">{desc}</p>

                  <a href="" className="learn-more">Learn More</a>
                </Card>
            )
          })
        }
      </div>
    </section>
  );
};

export default LatestEvents;
