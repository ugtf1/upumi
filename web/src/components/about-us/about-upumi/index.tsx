import React from 'react';
import './about-upumi.scss';

const AboutUpumi: React.FC = () => {
    return (
        <section className="about-upumi">
            <div className="logo-image">
                <img src="/images/full-logo-3.svg" alt="UPUMI Logo" />
                
            </div>
            <div className="about-upumi-text">
                <p>
                At UPUMI, we unite the Urhobo community through cultural, social, and educational initiatives that preserve our heritage and instill traditional values in future generations. We support new arrivals, assist members in need, and address key issues affecting our people. Through fundraisers, civic engagement, and charitable efforts, we empower Urhobo communities both in the U.S. and at home. We also collaborate with local organizations to celebrate cultural diversity and uphold Urhobo customs through traditional ceremonies, strengthening our shared identity.
                </p>
            </div>
        </section>
    );
};

export default AboutUpumi;