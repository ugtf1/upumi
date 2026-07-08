import React from 'react';

const PrivacyPolicy = () => {
  return (
    <div style={{ maxWidth: 800, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 32, marginBottom: 16 }}>Privacy Policy</h1>
      <p>Last updated: {new Date().toLocaleDateString()}</p>
      
      <h2 style={{ fontSize: 24, marginTop: 24, marginBottom: 12 }}>1. Introduction</h2>
      <p>Welcome to UPUMI. We respect your privacy and are committed to protecting your personal data.</p>
      
      <h2 style={{ fontSize: 24, marginTop: 24, marginBottom: 12 }}>2. Information We Collect</h2>
      <p>We may collect personal identification information including, but not limited to, your name, email address, and phone number when you register for an account or interact with our services.</p>

      <h2 style={{ fontSize: 24, marginTop: 24, marginBottom: 12 }}>3. How We Use Your Information</h2>
      <p>We use the information we collect to operate, maintain, and provide the features and functionality of our services, as well as to communicate directly with you.</p>

      <h2 style={{ fontSize: 24, marginTop: 24, marginBottom: 12 }}>4. SMS and Text Messages</h2>
      <p>If you opt-in to receive SMS text messages from us, we will use your phone number to send you account updates, security codes, and important notifications. <strong>We do not share your phone number or SMS consent with third parties or affiliates for marketing purposes.</strong> You can opt-out at any time by replying STOP to our messages.</p>
      
      <h2 style={{ fontSize: 24, marginTop: 24, marginBottom: 12 }}>5. Contact Us</h2>
      <p>If you have any questions about this Privacy Policy, please contact us.</p>
    </div>
  );
};

export default PrivacyPolicy;
