import "./hero.scss";
const Hero = () => {

  return (
    <main className="hero-section">
      <section className="hero-section-container">
        <img
          src="/images/hero-first-image.svg"
          loading="lazy"
          alt="Upumi"
          className="first-image"
        />
      </section>
      
      <section>
      <div className="hero-description">
          <h1 className="hero-text">
            Urhobo Progress Union
            <br />
            Michigan
          </h1>
          <p className="hero-text-two">Okugbe, Egba, voyan robaro</p>
          <h2 className="second-text">PROMOTING CULTURE, UNITY & LOVE</h2>

          <button className="second-btn-section">Learn More</button>
        </div>
      </section>


      <section className="second-section-image">
        <img
          src="/images/hero-second-image.svg"
          alt=""
          loading="lazy"
          className="second-image"
        />
      </section>
     
    </main>
  );
};
export default Hero;