const TermsOfService = () => {
  return (
    <div style={{ maxWidth: 800, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 32, marginBottom: 16 }}>Terms of Service</h1>
      <p>Last updated: {new Date().toLocaleDateString()}</p>
      
      <h2 style={{ fontSize: 24, marginTop: 24, marginBottom: 12 }}>1. Acceptance of Terms</h2>
      <p>By accessing or using our services, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the service.</p>
      
      <h2 style={{ fontSize: 24, marginTop: 24, marginBottom: 12 }}>2. Accounts</h2>
      <p>When you create an account with us, you must provide accurate, complete, and current information at all times. Failure to do so constitutes a breach of the Terms.</p>

      <h2 style={{ fontSize: 24, marginTop: 24, marginBottom: 12 }}>3. Communications</h2>
      <p>By creating an account and opting in, you agree to receive essential communications from us, including SMS messages and emails related to your account. You can opt out of non-essential communications at any time.</p>

      <h2 style={{ fontSize: 24, marginTop: 24, marginBottom: 12 }}>4. Changes</h2>
      <p>We reserve the right, at our sole discretion, to modify or replace these Terms at any time.</p>
    </div>
  );
};

export default TermsOfService;
