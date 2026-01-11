import { useState } from "react";
import "./events-sidebar.scss";
import { EventDetails } from "../../../components";
import { upcomingEventsData } from "./data";

// Define the Event type based on your event data structure
interface Event {
  id: number;
  title: string;
  date: string;
  time: string;
  venue: string;
  description: string;
  image: string;
}

export default function EventsSidebar() {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null); // State to track the selected event

  return (
    <div className="events-side-bar">
      <h2 className="events-side-bar-title">EVENTS</h2>
      <div className="side-event-container">
        {upcomingEventsData.map((event) => (
          <div className="side-event-item" key={event.id}>
            <p className="event-date">{event.date}</p>
            <div
              className="event-details"
              onClick={() => {
                setSelectedEvent(event); // Set the clicked event as the selected event
              }}
            >
              {event.title}
            </div>
          </div>
        ))}
      </div>

      {/* Conditionally render the modal if an event is selected */}
      {selectedEvent && (
        <EventDetails
          closeModal={() => setSelectedEvent(null)} // Close modal by resetting the selected event
          event={selectedEvent} // Pass the selected event data to the modal
        />
      )}
    </div>
  );
}