import { FaTwitter } from "react-icons/fa";
import { FaInstagramSquare } from "react-icons/fa";
import { FaFacebook } from "react-icons/fa";
import { Link } from "react-router-dom";
import { footerData } from "./data";
import './footer-for-other-pages.scss'

const FooterForOtherPages = () => {
  return (
    <main>

    
    <footer className="footer">
    <Link to="/" className="logo">
      <img
        className="logo-img"
        src="/logo/upu-logo.svg"
        alt="Upumi Logo"
        loading="lazy"
      />
      <h1 className="logo-text">UPUMI</h1>
    </Link>
    <ul className={"nav-links"}>
      {footerData.map((item, index) => (
        <li key={index}>
          <Link
            className={`links ${
              location.pathname === item.url ? "active" : ""
            }`}
            to={item.url}
          >
            {item.title}
          </Link>
        </li>
      ))}
    </ul>

    {/*----------------FOOTER SECTION------------------*/}
    <section className="footer-links">
      <a href="">
        <FaTwitter className="social-links" />
      </a>
      <a href="">
        <FaInstagramSquare className="social-links" />
      </a>
      <a href="">
        <FaFacebook className="social-links" />
      </a>
    </section>
    
  </footer>
  <p className="copyright">
        Copyright © 2024 Urhobo Progress Union America
      </p>
  </main>
  )
}

export default FooterForOtherPages