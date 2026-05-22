import React from "react";
import "./event-banner.scss";

interface EventBannerProps {
  reminderText: string;
  bannerImage: string;
}

// Functional Component
const EventBanner: React.FC<EventBannerProps> = ({
  reminderText,
  bannerImage,
}) => {
  return (
    <div className="event-banner">
      <div className="banner-container">
        <div className="reminder"> Remider: &nbsp;&nbsp;&nbsp; {reminderText}</div>
          <img src={bannerImage} alt="Event Banner" />
      </div>
    </div>
  );
};

export default EventBanner;
