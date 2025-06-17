import { useState } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import EventDetailsModal from '../calender-details-modal';
import './calendar.scss';
import { events } from "./data";

const localizer = momentLocalizer(moment);

interface Event {
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  description?: string;
  location?: string;
}

function MyCalendar() {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
  };

  const closeModal = () => {
    setSelectedEvent(null);
  };

  return (
    <div className='calendar-container'>
      <Calendar
        localizer={localizer}
        defaultView="month"
        views={['month']}
        events={events}
        onSelectEvent={handleEventClick}
      />

      {selectedEvent && (
        <EventDetailsModal 
          event={selectedEvent} 
          onClose={closeModal} 
        />
      )}
    </div>
  );
}

export default MyCalendar;