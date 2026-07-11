const PrivacyPolicy = () => {
  return (
    <div style={{ maxWidth: 800, margin: "40px auto", padding: 16, color: "black" }}>
      <h1 style={{ fontSize: 32, marginBottom: 16 }}>Privacy Policy</h1>
      <p>Last updated: {new Date().toLocaleDateString()}</p>
      
      <h2 style={{ fontSize: 24, marginTop: 24, marginBottom: 12 }}>1. Introduction</h2>
      <p>Welcome to UPUMI. We respect your privacy and are committed to protecting your personal data.</p>
      
      <h2 style={{ fontSize: 24, marginTop: 24, marginBottom: 12 }}>2. Information We Collect</h2>
      <p>We may collect personal identification information including, but not limited to, your name, email address, and phone number when you register for an account or interact with our services.</p>

      <h2 style={{ fontSize: 24, marginTop: 24, marginBottom: 12 }}>3. How We Use Your Information</h2>
      <p>We use the information we collect to operate, maintain, and provide the features and functionality of our services, as well as to communicate directly with you.</p>

      <h2 style={{ fontSize: 24, marginTop: 24, marginBottom: 12 }}>4. SMS Communications</h2>
      <p style={{ marginBottom: 12 }}>
        By providing your phone number and opting in, you consent to receive SMS text messages from UPUMI regarding account updates, security codes (OTP), and important notifications. Message frequency may vary. Standard message and data rates may apply.
      </p>
      <h3 style={{ fontSize: 18, marginTop: 16, marginBottom: 8 }}>Consent and Opt-In</h3>
      <p style={{ marginBottom: 12 }}>
        Users must explicitly opt-in to receive SMS messages. This consent is obtained when you check the consent box on our registration page or login page before submitting your phone number. Your consent preferences are securely saved in our system.
      </p>
      <h3 style={{ fontSize: 18, marginTop: 16, marginBottom: 8 }}>Opt-Out Instructions</h3>
      <p style={{ marginBottom: 12 }}>
        You may opt out of receiving SMS messages at any time by replying <strong>STOP</strong> to any message. After opting out, you will no longer receive SMS communications from us.
      </p>
      <h3 style={{ fontSize: 18, marginTop: 16, marginBottom: 8 }}>Data Sharing and Privacy</h3>
      <p>
        We do not share your phone number or SMS consent with third parties or affiliates for marketing purposes.
      </p>
      
      <h2 style={{ fontSize: 24, marginTop: 24, marginBottom: 12 }}>5. Contact Us</h2>
      <p>If you have any questions about this Privacy Policy, please contact us at support@upumi.com or ono@ugtf.org</p>
    </div>
  );
};

export default PrivacyPolicy;
