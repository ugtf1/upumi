import React from "react";
import "./upcoming-events.scss";
import {GeneralModal}  from "../../components";
import { IoClose } from "react-icons/io5";
import { MdEmail } from "react-icons/md";
import { FaWhatsappSquare } from "react-icons/fa";
const UpcomingEvents: React.FC = () => {
  const [showMore, setShowMore] = React.useState(false);

  const closeModal = () => {
    setShowMore(false);
  };

  // Close modal only when clicking outside the modal content
  const onOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  };

  return (
    <section className="upcomingEvents">
      <h2>Upcoming Events</h2>
      <div className="upcomingEventCard">
        <div className="eventImage">
          <img src="/images/up-coming-event.svg" alt="UPUMI Fundraiser" />
        </div>
        <div className="eventDetails">
          <h3>Urhobo Progress Union Michigan Fundraiser</h3>
          <p>
            Join us for an inspiring evening dedicated to raising funds for
            UPUMI's life-changing initiatives, including vocational training,
            scholarships, medical outreach, and community development. This
            special event will bring together passionate individuals, community
            leaders, and supporters who believe in creating opportunities for a
            better future. Enjoy an evening of meaningful connections, guest
            speakers, and fundraising activities. All in support of equipping
            men, women, and youth with the skills and resources they need to
            thrive.
          </p>
          <p>
            Your presence and generosity can transform lives. Let's make a
            difference together!
          </p>
          <p>
            <b>Details are:</b>
          </p>
          <p>
            <b>Date:</b> April 12th 2025 6-10pm
          </p>
          <p>
            <b>Location:</b> Divine Providence Lithuanian 25335 W Nine Mile Rd,
            Southfield, MI 48033
          </p>
          <button
            className="learnMoreButton2"
            onClick={() => setShowMore(true)}
          >
            LEARN MORE
          </button>

          {showMore && (
            <GeneralModal  className="learn-more" closeModal={closeModal}>
              {/* Overlay div to catch outside clicks */}
              <div className="upumi-payment-modal" onClick={onOverlayClick}>
                <div className="upumi-payment-overlay"></div>
                <div
                  className="upumi-payment-modal-content"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="upumi-close-section">
                    <button
                      className="upumi-close-button"
                      onClick={() => closeModal()}
                      aria-label="Close payment modal"
                    >
                      <IoClose />
                    </button>
                  </div>
                  <h1 className="vocation-text">
                    VOCATIONAL & PROFESSIONAL SKILLS TRAINING LIST:
                  </h1>
                  <div className="vocation-section">
                    <ul>
                      <li>FASHION DESIGN (TAILORING) TRAINING</li>
                      <li>WELDING AND FABRICATION TRAINING</li>
                      <li>OIL & GAS OPERATIONS AND MAINTENANCE TRAINING</li>
                      <li>RIGGING AND LIFTING TRAINING</li>
                      <li>SCAFFOLDING TRAINING</li>
                      <li>ROPE ACCESS TRAINING</li>
                      <li>PAINTING AND SANDBLASTING TRAINING</li>
                      <li>GSM REPAIR TRAINING</li>
                      <li>BAG MAKING TRAINING</li>
                      <li>SUSPENDED CEILING AND POP TRAINING</li>
                      <li>SOLAR PANEL INSTALLATION TRAINING</li>
                      <li>CATERING AND BAKING TRAINING</li>
                      <li>SOAP AND CREAM MAKING TRAINING</li>
                      <li>SHOE MAKING TRAINING</li>
                      <li>AUXILIARY NURSES TRAINING</li>
                      <li>PHYSIOTHERAPY TECHNICIAN TRAINING</li>
                      <li>AUTO MECHANIC TRAINING</li>
                      <li>ELECTRICAL TRAINING</li>
                      <li>PLUMBING TRAINING</li>
                      <li>COST CONTROL AND PROJECT SCHEDULING TRAINING</li>
                    </ul>

                    <ul>
                      <li>DRONE OPERATIONS AND CINEMATOGRAPHY TRAINING</li>
                      <li>AGRO-PROCESSING & FARMING TRAINING</li>
                      <li>FPSO and SUBSEA TRAINING</li>
                      <li>Elevator installation and repair</li>
                      <li>Real estate/Realtor training</li>
                      <li>Hospitality services training</li>
                      <li>Aircraft maintenance technicians</li>
                      <li>Physical Therapy/physiotherapy Aids</li>
                      <li>Dental technicians</li>
                      <li>Surgical technicians</li>
                      <li>Telemarketing training</li>
                      <li>Social media influencer</li>
                      <li>Optometry technicians</li>
                      <li>Cleaners</li>
                      <li>Photography</li>
                      <li>Garbage management</li>
                      <li>Events Organizers</li>
                      <li>Borehole technicians</li>
                      <li>Fish and animal farming</li>
                      <li>
                        Yam, cassava, cocoyam, vegetable, snails, chicken etc
                        farming
                      </li>
                      <li>Laundry services etc....</li>
                    </ul>

                    <h1 className="message">Send us Message</h1>
                    <div className="modal-links">
                      <a href="">
                        <MdEmail className="links" />
                      </a>
                      <a href="">
                        <FaWhatsappSquare className="links" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </GeneralModal >
          )}
        </div>
      </div>
    </section>
  );
};

export default UpcomingEvents;
