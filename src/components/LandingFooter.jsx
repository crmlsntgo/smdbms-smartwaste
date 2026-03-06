import React from 'react';
import '../styles/components/landing-footer.css';

const LandingFooter = () => {
  return (
    <footer className='sw-landing-footer'>
      <div className='sw-landing-footer__content'>
        
        {/* Left Section: Brand */} 
        <div className='sw-landing-footer__brand'>
            <div className='sw-landing-footer__logo'>
                <div className='sw-landing-footer__logo-icon'>
                    <i className="fas fa-trash"></i>
                </div>
                <div className='sw-landing-footer__logo-text'>
                    <span className='text-green'>SMART</span>
                    <span className='text-white'>DUSTBIN</span>
                </div>
            </div>
            <p className='sw-landing-footer__tagline'>
                Innovative IoT-based waste management solutions for smarter communities.
            </p>
            <div className='sw-landing-footer__socials'>
                <a href='#'><i className='fab fa-facebook-f'></i></a>
                <a href='#'><i className='fab fa-twitter'></i></a>
                <a href='#'><i className='fab fa-instagram'></i></a>
                <a href='#'><i className='fab fa-linkedin-in'></i></a>
            </div>
            <p className='sw-landing-footer__copyright'>
                &copy; 2025 Smart Dustbin. All rights reserved.
            </p>
        </div>

        {/* Middle Section: Newsletter */} 
        <div className='sw-landing-footer__newsletter'>
            <h3>Subscribe to our Newsletter</h3>
            <p>Stay up to date on the latest SmartWaste news, announcements, and product launches.</p>
            <form className='sw-landing-footer__form' onSubmit={(e) => e.preventDefault()}>
                <input type='email' placeholder='Email*' required />
                <button type='submit'>Subscribe</button>
            </form>
        </div>

        {/* Right Section: Links */} 
        <div className='sw-landing-footer__links'>
            <div className='sw-landing-footer__col'>
                <h4>Quick Links</h4>
                <ul>
                    <li><a href='/'>Home</a></li>
                    <li><a href='/#features'>Features</a></li>
                    <li><a href='/support#contact'>Support</a></li>
                </ul>
            </div>
            <div className='sw-landing-footer__col'>
                <h4>Contact Us</h4>
                <ul className='contact-info'>
                    <li><i className='fas fa-map-marker-alt'></i> 123 Sarany Street, Tech City, 8700</li>
                    <li><i className='fas fa-phone-alt'></i> (+63)991 540 8198</li>
                    <li><i className='fas fa-envelope'></i> smdbms@smartdustbin.com</li>
                </ul>
            </div>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;
