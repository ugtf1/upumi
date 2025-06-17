import "./subscribe.scss";

const Subscribe = () => {
  return (
    <main className="subscribe-container">
      <section className="wrapper-container">
        <div className="sub-wrapper">
          <h1 className="sub-title">Subscribe Newsletter</h1>
          <p className="sub-text">
            Sign up and receive updates on events and awesome projects.
          </p>


          <div className="input-and-sub-btn">
            <input
              type="text"
              name=""
              id=""
              className="inputbox"
              placeholder="Enter Your Email"
            />
            <button className="sub-btn">SUBSCRIBE</button>
          </div>

        </div>
        <img src="/images/subscribe-image.svg" alt="" className="sub-image" />
      </section>
    </main>
  );
};

export default Subscribe;
