import { IoClose } from "react-icons/io5";
import "./event-details.scss";

interface EventDetailsProps {
  closeModal: () => void;
  event: {
    image?: string;
    id: number;
    title: string;
    date: string;
    time: string;
    venue: string;
    description: string;
  };
}

const EventDetails = ({ closeModal, event }: EventDetailsProps) => {
  const hasImage = !!event.image;

  return (
    <div className="modal">
      <div className="overlay" onClick={closeModal}></div>
      <div className="modal-content">
        <IoClose className="close-modal" onClick={closeModal} />
        <div className="modal-body">
          <div className={`modal-sub-body ${!hasImage ? 'full-width-details' : ''}`}>
            {hasImage && (
              <div className="event-image">
                <img src={event.image} alt={event.title} />
              </div>
            )}
            <div className="event-details">
            <h3>{event.title}</h3>
              <p>
                <b>Date:</b> {event.date} 
              </p>
              <p>
                <b>Time:</b> {event.time}
              </p>
              <p>
                <b>Venue:</b> {event.venue}
              </p>
              <p>
                <b>Details:</b> {event.description}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetails;