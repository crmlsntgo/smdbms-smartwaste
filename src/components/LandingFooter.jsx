import React from 'react';
import '../styles/components/landing-footer.css';

const LandingFooter = () => {
  return (
    <footer className="sw-footer">
      <div className="sw-footer__content">
        
        {/* Top Section: Logo */}
        <div className="sw-footer__logo-section">
            <a href="#" className="sw-footer__logo">
              <i className="fas fa-trash-alt"></i>
              <span>SmartWaste</span>
            </a>
        </div>

        {/* Middle Section: Links & Newsletter */}
        <div className="sw-footer__middle">
          
          <div className="sw-footer__links">
            <div className="sw-footer__col">
              <a href="#" className="sw-footer__head-link">Solutions</a>
            </div>
            <div className="sw-footer__col">
              <a href="#" className="sw-footer__head-link">All Products</a>
            </div>
            <div className="sw-footer__col">
              <h4 className="sw-footer__heading">About SmartWaste</h4>
              <ul>
                <li><a href="#">Careers</a></li>
                <li><a href="#">SmartWaste Worldwide</a></li>
              </ul>
            </div>
            <div className="sw-footer__col">
              <h4 className="sw-footer__heading">All Downloads</h4>
              <ul>
                <li><a href="#">Company Brochure</a></li>
                <li><a href="#">Suite of Bins</a></li>
              </ul>
            </div>
          </div>

          <div className="sw-footer__newsletter">
             <h4 className="sw-footer__newsletter-title">Subscribe to our Newsletter</h4>
             <p className="sw-footer__newsletter-text">Stay up to date on the latest SmartWaste news, announcements, and product launches.</p>
             <form className="sw-footer__form" onSubmit={(e) => e.preventDefault()}>
                <input type="email" placeholder="Email*" required />
                <button type="submit">Subscribe</button>
             </form>
          </div>
        </div>

        {/* Bottom Contact Section */}
        <div className="sw-footer__contact-section">
             <div className="sw-footer__address">
                <p>150 Innovation Street | Suite 103 Green City, GC 02494 | USA</p>
                <p><strong>Phone:</strong> +1-888-820-0300</p>
                <p><strong>Email:</strong> info@smartwaste.com</p>
             </div>
             
             <div className="sw-footer__social">
                <a href="#" aria-label="Facebook"><i className="fab fa-facebook-f"></i></a>
                <a href="#" aria-label="Twitter"><i className="fab fa-twitter"></i></a>
                <a href="#" aria-label="LinkedIn"><i className="fab fa-linkedin-in"></i></a>
                <a href="#" aria-label="YouTube"><i className="fab fa-youtube"></i></a>
                <a href="https://www.instagram.com/smartwaste" aria-label="Instagram"><i className="fab fa-instagram"></i></a>
             </div>
        </div>

        {/* Legal Links (Bottom) */}
        <div className="sw-footer__legal">
           <a href="#">Patents</a>
           <a href="#">Privacy Policy</a>
           <a href="#">Cookie Policy</a>
        </div>

      </div>
    </footer>
  );
};

export default LandingFooter;
