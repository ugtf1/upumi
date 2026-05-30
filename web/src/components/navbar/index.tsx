import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BiSolidHeart } from "react-icons/bi";
import { CiMenuBurger } from "react-icons/ci";
import { IoMdClose } from "react-icons/io";
import { Modal } from "../../components";
import "./navbar.scss";
import { navbarData } from "./data";
import { clearToken, getAuthClaims, getToken } from "../../addons/api";

const Navbar = () => {
  const [isNavShowing, setIsNavShowing] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [openModal, setOpenModal] = useState(false);
  const token = getToken();
  const claims = getAuthClaims();
  const isAuthed = !!token;
  const isAdmin = claims?.role === "ADMIN";

  const portalLinks = [
    !isAuthed ? { title: "Login", url: "/login" } : { title: "Dashboard", url: "/analytics" },
    !isAuthed ? { title: "Register", url: "/register" } : null,
    isAuthed ? { title: "Membership status", url: "/pivot" } : null,
    isAdmin ? { title: "Admin", url: "/admin" } : null,
  ].filter(Boolean) as { title: string; url: string }[];

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
        <div
          style={{ marginLeft: 12, position: "relative" }}
          onMouseLeave={() => setPortalOpen(false)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              setPortalOpen(false);
            }
          }}
        >
          <button
            type="button"
            style={{
              cursor: "pointer",
              background: "#0b6b43",
              border: "1px solid #0b6b43",
              borderRadius: 8,
              width: 38,
              height: 38,
              padding: 0,
              color: "#ffffff",
              display: "grid",
              placeItems: "center",
            }}
            title="Portal menu"
            onClick={() => setPortalOpen((v) => !v)}
          >
            <CiMenuBurger />
          </button>
          {portalOpen && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                minWidth: 220,
                background: "#fff",
                border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: 10,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                padding: 8,
                zIndex: 30,
                display: "grid",
                gap: 4,
              }}
            >
              {portalLinks.map((item) => (
                <Link
                  key={item.url}
                  to={item.url}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    color: "#1b1b1b",
                    textDecoration: "none",
                    background: location.pathname === item.url ? "#ecf8f1" : "transparent",
                  }}
                  onClick={() => {
                    setIsNavShowing(false);
                    setPortalOpen(false);
                  }}
                >
                  {item.title}
                </Link>
              ))}
              {isAuthed && (
                <button
                  type="button"
                  style={{
                    textAlign: "left",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: "#a12626",
                  }}
                  onClick={() => {
                    clearToken();
                    setIsNavShowing(false);
                    setPortalOpen(false);
                    navigate("/login", { replace: true });
                  }}
                >
                  Logout
                </button>
              )}
            </div>
          )}
        </div>
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
                onClick={() => setIsNavShowing(false)}
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
