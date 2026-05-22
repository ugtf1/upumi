import { IoClose } from "react-icons/io5";
import './fundraiser.scss'
const FundRaiser = ({ closeModal }: any) => {
  return (
    <>
      <div className="modal">
        <div className="overlay"></div>
        <div className="modal-content">
          <IoClose
                className="close-modal"
                onClick={() => closeModal(false)}
              />
          <div className="close-modal-section ">
            <div className="upcomingEventCard">
              <div className="eventImage">
                <img src="/images/up-coming-event.svg" alt="UPUMI Fundraiser" />
              </div>
              <div className="eventDetails">
                <h3>Urhobo Progress Union Michigan Fundraiser</h3>
                <p>
                  <b>Details:</b>
                </p>
                <p>
                  <b>Date:</b> April 12th 2025 6-10pm
                </p>
                <p>
                  <b>Location:</b> Divine Providence Lithuanian 25335 W Nine
                  Mile Rd, Southfield, MI 48033
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default FundRaiser;
