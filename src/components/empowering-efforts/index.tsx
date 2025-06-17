import React from 'react';
import './empowering-efforts.scss';

const EmpoweringEfforts: React.FC = () => {
  return (
    <section className="empoweringEffortsSection">
      <div className="empoweringEfforts">
        <div className="empoweringEffortsHeading">
          <h2>Empowering Urhobo People Through Our Efforts.</h2>
          <p>Efforts embarked on by our community.</p>
        </div>
        <div className="effortCards">
          <div className="effortCard">
            <img src="/images/enpowerment-1.svg" alt="Healthcare" />
            <h3>Healthcare</h3>
          </div>
          <div className="effortCard">
            <img src="/images/enpowerment-2.svg" alt="Education" />
            <h3>Education</h3>
          </div>
          <div className="effortCard">
            <img src="/images/enpowerment-3.svg" alt="Community" />
            <h3>Community</h3>
          </div>
          <div className="effortCard">
            <img src="/images/enpowerment-4.svg" alt="Vocation" />
            <h3>Vocation</h3>
          </div>
        </div>
      </div>
    </section>
  );
};

export default EmpoweringEfforts;