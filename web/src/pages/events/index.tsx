import { useState } from "react";
import {
  FooterForOtherPages,
  Subscribe,
  SliderModal,
  Carousel,
  EventBanner,
  MyCalendar,
  EventsSidebar,
} from "../../components";
import "./events.scss";
import { events } from "../../components/events/calendar/data"; // Import the events data

interface Event {
  start: Date;
  title: string;
  location: string;
  allDay?: boolean;
}

// Helper function to get the next upcoming event
function getNextEvent(events: Event[]) {
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Remove time part for accurate date comparison

  // Filter future events and sort them
  const upcomingEvents = events
    .filter((event) => {
      console.log(event.start);
      return new Date(event.start) >= now;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return upcomingEvents[0]; // Return the first upcoming event
}

// Format the event for display
function formatEventReminder(event: Event | null) {
  if (!event) return "No upcoming events";

  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
  };
  const dateStr = event.start.toLocaleDateString("en-US", options);
  const timeStr = event.allDay
    ? ""
    : `, ${event.start.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;

  return `${event.title} is on ${dateStr}${timeStr}. Location: ${event.location}`;
}

const Events = () => {
  const nextEvent = getNextEvent(events);
  const reminderText = nextEvent
    ? formatEventReminder(nextEvent)
    : "No upcoming events";
  const bannerImage = "/images/banner.svg";

  const [openModal, setOpenModal] = useState(false);
  return (
    <main className="events">
      <div className="events-container">
        <EventBanner reminderText={reminderText} bannerImage={bannerImage} />

        <div className="events-calendar-container">
          <EventsSidebar />
          <div className="events-calendar">
            <MyCalendar />
          </div>
        </div>
        <h1 className="highlight-title">Highlights</h1>
        <hr />

        <section className="container">
          <div className="high-container">
            <h1 className="high-title">UPUMI 5K (2024)</h1>

            <div className="high-wrapper">
              <div className="image-container">
                <img src="/images/UPU-1.svg" alt="" className="first-image" />
                <img src="/images/UPU-2.svg" alt="" className="first-image" />
              </div>

              <div className="second-image-container">
                <img src="/images/UPU-1.svg" alt="" className="second-image" />
                <img src="/images/UPU-4.svg" alt="" className="second-image" />
                <div className="see-more-container">
                  <div onClick={() => setOpenModal(true)}>
                    <img
                      src="/images/UPU-5.svg"
                      alt=""
                      className="second-image see-more-pic"
                    />
                    <div className="see-more-text">
                      <h2 className="see-title">See More</h2>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal should be outside the main content flow */}
          <SliderModal isOpen={openModal} onClose={() => setOpenModal(false)}>
            <Carousel />
          </SliderModal>
        </section>
        <section className="container">
          <div className="high-container">
            <h1 className="high-title">UPUA 2024 Convention</h1>

            <div className="high-wrapper">
              <div className="image-container">
                <img src="/images/fund-1.svg" alt="" className="first-image" />
                <img src="/images/fund-2.svg" alt="" className="first-image" />
              </div>

              <div className="second-image-container">
                <img src="/images/fund-1.svg" alt="" className="second-image" />
                <img src="/images/fund-4.svg" alt="" className="second-image" />
                <img src="/images/fund-5.svg" alt="" className="second-image" />
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="sub">
        <Subscribe />
      </div>
      <FooterForOtherPages />
    </main>
  );
};

export default Events;
