import React from 'react';
import './our-efforts.scss';

const OurEfforts: React.FC = () => {
    return (
        <section className="our-efforts">
            <div className="our-efforts-heading">
                <h2>Our Efforts</h2>
                <p>Efforts embarked on by our community.</p>
            </div>
            <div className="effort-cards">
                <div className="effort-card">
                    <div className="image-container">
                        <img src="/images/our-effort-group-image.svg" alt="Project 1" />
                    </div>
                    <div className="text-container">
                        <h3>UPUMI 5K</h3>
                        <p>
                        Join us for the annual UPUMI 5K, a run dedicated to raising funds for our life-changing projects. Every step you take supportseducation, vocational training, healthcare, and community development for those in need. Run. Give. Transform Lives. Be a part of the movement!
                        </p>
                    </div>
                </div>
                {/* Repeat for other effort cards */}
            </div>
           
        </section>
    );
};

export default OurEfforts;