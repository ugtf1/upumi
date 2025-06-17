import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BiSolidHeart } from "react-icons/bi";
import { CiMenuBurger } from "react-icons/ci";
import { IoMdClose } from "react-icons/io";
import { Modal } from "../../components";
import "./navbar.scss";
import { navbarData } from "./data";

const Navbar = () => {
  const [isNavShowing, setIsNavShowing] = useState(false);
  const location = useLocation();
  const [openModal, setOpenModal] = useState(false);
  return (
    <nav className="navbar">
      <div className="navbar-left">
        <Link to="/" className="logo">
          <img
            className="logo-img"
            src="/logo/upu-logo.svg"
            alt="Upumi Logo"
            loading="lazy"
          />
          <h1 className="logo-text">UPUMI</h1>
        </Link>
      </div>

      <div className="navbar-right">
        <ul className={`nav-links ${isNavShowing ? "show_nav" : "hide_nav"}`}>
          {navbarData.map((item, index) => (
            <li key={index}>
              <Link
                className={`links ${
                  location.pathname === item.url ? "active" : ""
                }`}
                to={item.url}
                onClick={() => setIsNavShowing((prev) => !prev)}
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
        <div className="btn-right">
            <Link
              to="#"
              className="contact-btn" 
              onClick={()=>{setOpenModal(true)}}
            >
              Donate <BiSolidHeart className="contact-icon" />
            </Link>
            {openModal && <Modal  closeModal={setOpenModal}/>}
          
          <a href="" className="join-community">
            Join Our Community
          </a>
        </div>
      </div>

      <button
        className="nav_toggle-btn"
        onClick={() => setIsNavShowing((prev) => !prev)}
      >
        {isNavShowing ? (
          <IoMdClose className="menu" />
        ) : (
          <CiMenuBurger className="menu" />
        )}
      </button>
    </nav>
  );
};

export default Navbar;
