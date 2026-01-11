
import "./footer.scss";

const Footer = () => {
  return (
    <main className="footer-container">
      {/*----------------JOIN OUR COMMNUITY SECTION------------------*/}
      
      <section className="join-community">
        <img
          src="/images/footer-image.svg"
          alt=""
          className="join-image"
        />
        <div className="sub-join-community">
          <h1 className="join-title">Join the Commnuity</h1>
          <p className="join-text">
            Sign up and receive updates on events and awesome projects.
          </p>

          <div className="sub-section">
            <input type="text" className="inputbox" />
            <button className="join-btn">SUBCRIBE</button>
            <br />
            
          </div>
          <span className="join-policy">
              We care about your data in our
              <a href="" className="policy-link">
                privacy policy
              </a>
            </span>
        </div>
      </section>
     
      
    </main>
  );
};

export default Footer;
