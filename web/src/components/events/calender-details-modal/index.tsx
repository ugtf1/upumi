import { IoClose } from 'react-icons/io5';
import moment from 'moment';
import './calender-details-modal.scss';


interface EventDetailsModalProps {
  event: {
    title: string;
    start: Date;
    end: Date;
    allDay: boolean;
    description?: string;
    location?: string;
  };
  onClose: () => void;
}

const EventDetailsModal = ({ event, onClose }: EventDetailsModalProps) => {
  return (
    <div className="event-modal">
      <div className="modal-overlay" onClick={onClose}></div>
      <div className="modal-content">
        <IoClose className="close-button" onClick={onClose} />
        
        <div className="event-details">
        <h2>{event.title}</h2>
          <p>
            <b>Date:</b> {moment(event.start).format('dddd, MMMM Do, YYYY')}
          </p>
          
          {event.description && (
            <p>
              <b>Description:</b> {event.description}
            </p>
          )}
          
          {event.location && (
            <p>
              <b>Location:</b> {event.location}
            </p>
          )}
          
          <p>
            <strong>Duration:</strong> {event.allDay ? 'All day' : 
              `${moment(event.start).format('h:mm a')} - ${moment(event.end).format('h:mm a')}`}
          </p>
        </div>
      </div>
    </div>
  );
};

export default EventDetailsModal;