import React from 'react';
import './about-hero.scss';

const AboutUsHeroSection: React.FC = () => {
    return (
        <section className="about-us-section">
            <div className="about-us-content">
                <h1>ABOUT US</h1>
                <h2>Empowering Lives, Transforming Communities</h2>
                <p>
                    At UPUMI, we are dedicated to creating lasting change through education, vocational training, healthcare, and community development. By equipping individuals with the skills and resources they need, we empower them to build brighter futures for themselves and their communities. Together, we are making a difference—one step at a time.
                </p>
            </div>
            <div className="about-us-image">
                <img src="/images/about-hero-image.svg" alt="UPUMI Members" />
            </div>
        </section>
    );
};

export default AboutUsHeroSection;