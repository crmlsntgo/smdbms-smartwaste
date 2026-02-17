import React, { useLayoutEffect } from 'react'
import '../styles/vendor/landing-page.css'
import '../styles/vendor/support.css'
import LandingFooter from '../components/LandingFooter'

export default function Pricing() {
  useLayoutEffect(() => {
    document.body.classList.add('landing-page')
    return () => {
      document.body.classList.remove('landing-page')
    }
  }, [])

  return (
    <div>
        {/* Background Shapes (Reused from Landing for consistency) */}
        <div className="bg-animation">
            <div className="bg-shape bg-shape-1"></div>
            <div className="bg-shape bg-shape-2"></div>
            <div className="bg-shape bg-shape-3"></div>
        </div>

        {/* Header Navigation (Reused from Landing) */}
        <header className="landing-nav">
            <div className="landing-nav__container">
            <a href="/" className="landing-nav__logo">
                <div className="landing-nav__logo-icon">
                <i className="fas fa-trash"></i>
                </div>
                <div className="landing-nav__logo-text">
                <span className="landing-nav__logo-title">SMART</span>
                <span className="landing-nav__logo-subtitle">DUSTBIN</span>
                </div>
            </a>
            <nav className="landing-nav__menu">
                <a href="#" className="landing-nav__link">Product</a>
                <a href="/support" className="landing-nav__link">Support</a>
                <a href="#" className="landing-nav__link active">Services</a>
            </nav>
            <div className="landing-nav__actions">
                <a href="/login" className="landing-nav__signin">Sign in</a>
                <a href="/register" className="landing-nav__demo">Request Demo</a>
            </div>
            <button className="landing-nav__mobile-toggle" id="mobileMenuToggle">
                <i className="fas fa-bars"></i>
            </button>
            </div>
        </header>

        {/* Main Content - Pricing/Support Page Structure */}
        <main className="pricing-main">
            
            {/* Hero Section */}
            <section className="pricing-hero">
                <div className="pricing-hero__content">
                    <div className="pricing-hero__label">Support</div>
                    <h1 className="pricing-hero__title">Real support, from real experts<br/><span className="text-highlight">— anytime you need it</span></h1>
                    <p className="pricing-hero__subtitle">Our team is here for you 24/7, ready to help<br/>you solve problems, scale faster, and stay on track.</p>
                </div>
            </section>

            {/* Team Grid */}
            <section className="pricing-team">
                <div className="pricing-team__grid">
                    {/* Member 1 */}
                    <div className="team-member">
                        <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-1.2.1&auto=format&fit=crop&w=634&q=80" alt="Sarah Campbell" className="team-member__img" />
                        <div className="team-member__info">
                            <h4 className="team-member__name">Sarah Campbell</h4>
                            <p className="team-member__role">Lead Customer Success</p>
                        </div>
                    </div>
                    {/* Member 2 */}
                    <div className="team-member">
                        <img src="https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-1.2.1&auto=format&fit=crop&w=698&q=80" alt="Lily Brooks" className="team-member__img" />
                        <div className="team-member__info">
                            <h4 className="team-member__name">Lily Brooks</h4>
                            <p className="team-member__role">Support Specialist</p>
                        </div>
                    </div>
                    {/* Member 3 */}
                    <div className="team-member">
                        <img src="https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?ixlib=rb-1.2.1&auto=format&fit=crop&w=634&q=80" alt="Olivia Bennett" className="team-member__img" />
                        <div className="team-member__info">
                            <h4 className="team-member__name">Olivia Bennett</h4>
                            <p className="team-member__role">Account Manager</p>
                        </div>
                    </div>
                    {/* Member 4 */}
                    <div className="team-member">
                        <img src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-1.2.1&auto=format&fit=crop&w=1050&q=80" alt="Chloe Scott" className="team-member__img" />
                        <div className="team-member__info">
                            <h4 className="team-member__name">Chloe Scott</h4>
                            <p className="team-member__role">Head of Sales</p>
                        </div>
                    </div>
                    {/* Member 5 */}
                    <div className="team-member">
                        <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&auto=format&fit=crop&w=634&q=80" alt="Drew Carter" className="team-member__img" />
                        <div className="team-member__info">
                            <h4 className="team-member__name">Drew Carter</h4>
                            <p className="team-member__role">Sales Manager</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Contact Section */}
            <section className="pricing-contact" id="contact">
                <div className="pricing-contact__header">
                    <div className="contact-icon-wrapper">
                         {/* Placeholder for the icon in the image */}
                         <i className="fas fa-life-ring"></i>
                    </div>
                    <h2 className="pricing-contact__title">Contact our team</h2>
                    <p className="pricing-contact__subtitle">No matter your business, needs, or price inquiry, our team can help.</p>
                     <div className="contact-actions">
                    </div>
                </div>

                <div className="pricing-contact__content_wrapper">
                    {/* Form */}
                    <div className="contact-form-card">
                        <h3 className="contact-form-title">Send us a message</h3>
                        <form className="contact-form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label>First name *</label>
                                    <input type="text" placeholder="First name" />
                                </div>
                                <div className="form-group">
                                    <label>Last name *</label>
                                    <input type="text" placeholder="Last name" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Email *</label>
                                <input type="email" placeholder="you@company.com" />
                            </div>
                            <div className="form-group">
                                <label>Phone number</label>
                                <input type="tel" placeholder="+1 (555) 000-0000" />
                            </div>
                            <div className="form-group">
                                <label>Team size</label>
                                <select>
                                    <option>1-50 people</option>
                                    <option>51-200 people</option>
                                    <option>201-1000 people</option>
                                    <option>1000+ people</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Location</label>
                                <select>
                                    <option>Philippines</option>
                                    <option>China</option>
                                    <option>Japan</option>
                                    <option>South Korea</option>
                                    <option>United States</option>
                                    <option>United Kingdom</option>
                                    <option>Canada</option>
                                    <option>Australia</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Message *</label>
                                <textarea rows="4" placeholder="Leave us a message..."></textarea>
                            </div>

                            <div className="form-group checklist-group">
                                <label className="checklist-label">Which products are you interested in?</label>
                                <div className="checklist-grid">
                                    <label className="checkbox-item"><input type="checkbox" /> Smart Bins</label>
                                    <label className="checkbox-item"><input type="checkbox" /> Analytics Dashboard</label>                                    <label className="checkbox-item"><input type="checkbox" /> Other</label>
                                </div>
                            </div>

                            <button type="submit" className="btn-submit">Send message</button>
                        </form>
                    </div>

                    {/* Contact Info */}
                    <div className="contact-info-card">
                        <div className="info-item">
                            <h4 className="info-title">Chat to sales</h4>
                            <p className="info-desc">Interested in subscribing? Speak to our friendly team.</p>
                            <a href="mailto:sales@smartdustbin.com" className="info-link">sales@smartdustbin.com</a>
                        </div>
                        <div className="info-item">
                            <h4 className="info-title">Email support</h4>
                            <p className="info-desc">Email us and we'll get back to you within 24 hours.</p>
                            <a href="mailto:support@smartdustbin.com" className="info-link">support@smartdustbin.com</a>
                        </div>
                        <div className="info-item">
                            <h4 className="info-title">Call us</h4>
                            <p className="info-desc">Mon - Fri, 8:00 AM - 5:00 PM EST.</p>
                            <a href="tel:+15555555555" className="info-link">+1 (555) 555-5555</a>
                        </div>
                        <div className="info-item">
                            <h4 className="info-title">Global HQ</h4>
                            <p className="info-desc">Visit our office Mon - Fri, 9:00 AM - 5:00 PM.</p>
                            <address className="info-address">
                                <i className="fas fa-map-marker-alt"></i> 123 Innovation Drive, Tech City, TC 90210
                            </address>
                        </div>
                    </div>
                </div>
            </section>

        </main>

        {/* Footer */}
        <LandingFooter />
    </div>
  )
}
