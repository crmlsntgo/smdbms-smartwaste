import React, { useLayoutEffect, useState } from 'react'
import '../styles/vendor/landing-page.css'
import '../styles/vendor/product-page.css'
import LandingFooter from '../components/LandingFooter'

export default function Product() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useLayoutEffect(() => {
    document.body.classList.add('landing-page')
    return () => {
      document.body.classList.remove('landing-page')
    }
  }, [])

  return (
    <div>
      {/* Header Navigation */}
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
          <nav className={`landing-nav__menu ${isMenuOpen ? 'active' : ''}`}>
            <a href="/product" className="landing-nav__link active">Product</a>
            <a href="/support" className="landing-nav__link">Support</a>
            <a href="/solutions" className="landing-nav__link">Solutions</a>
          </nav>
          <div className="landing-nav__actions">
            <a href="/login" className="landing-nav__signin">Sign in</a>
            <a href="/register" className="landing-nav__demo">Request Demo</a>
          </div>
          <button 
            className="landing-nav__mobile-toggle" 
            id="mobileMenuToggle"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <i className="fas fa-bars"></i>
          </button>
        </div>
      </header>

      <main>
        {/* Products Showcase Section */}
        <section className="product-showcase">
          <div className="product-showcase-container">
            {/* Left Text Content */}
            <div className="product-showcase-text">
              <h2 className="product-showcase-title">Products Used</h2>
              <div className="product-desc">
                <p>
                  SmartWaste’s system is a high-efficiency solution specifically engineered for municipalities, universities, and industrial sectors.
                </p>
                <br />
                <p>
                  SmartWaste’s system provides a high-efficiency organic waste solution specifically engineered for municipalities, universities, and industrial sectors. These units are strategically deployed within the public right-of-way or common campus areas, facilitating rapid infrastructure integration without the need for individual building-level approvals.
By centralizing collection at high-capacity bin locations, the system optimizes operational workflows and maximizes logistics efficiency. Exclusively accessible to authorized utility staff and administrators, this streamlined model allows for the deployment and activation of a large-scale composting program in just a matter of weeks.

                </p>
              </div>
            </div>

            {/* Right Cards */}
            <div className="product-cards">
              {/* Card 1: Smart Compost Bin */}
              <div className="product-card">
                <div className="product-card-header">Smart Compost Bin</div>
                <div className="product-card-image-area">
                  {/* Bin Image - Place 'smart-compost-bin.png' in public/images/ */}
                  <img src="" alt="Smart Compost Bin" />
                </div>
                <div className="product-card-footer">
                  <p className="product-card-desc">
                    Fully enclosed, controlled access (47 Gal / 178 L) Smart Compost Bin
                  </p>
                  <a href="#" className="product-btn-green">View Product</a>
                </div>
              </div>

              {/* Card 2: Clean Software */}
              <div className="product-card">
                <div className="product-card-header">SmartWaste Software</div>
                <div className="product-card-image-area">
                  {/* Dashboard Image - Place 'clean-software-dashboard.png' in public/images/ */}
                  <img src="https://image2url.com/r2/default/images/1771436771075-d5ea55b7-21f5-4910-99f3-477bd8faa6e3.png" alt="SmartWaste Dashboard" />
                </div>
                <div className="product-card-footer">
                  <p className="product-card-desc">
                    SmartWaste's cloud-based software
                  </p>
                  <a href="#" className="product-btn-green">View Product</a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="how-it-works">
          <div className="how-it-works-container">
            <h2 className="how-it-works-title">How It Works</h2>
            <p className="how-it-works-subtitle">
              From deployment to optimization — a complete waste management solution for your organization.
            </p>

            <div className="process-steps">
               {/* Connecting Line - Visual only */}
               <div className="process-line"></div>

               {/* Step 1 */}
               <div className="process-step">
                 <div className="step-icon-wrapper">
                   <div className="step-icon">
                     <i className="fas fa-map-marker-alt"></i>
                   </div>
                   <div className="step-badge">01</div>
                 </div>
                 <div className="step-card">
                   <h3>Deploy Smart Bins</h3>
                   <p>Bins are strategically placed across your property or service area. No individual approvals or complex coordination required.</p>
                 </div>
               </div>

               {/* Step 2 */}
               <div className="process-step">
                 <div className="step-icon-wrapper">
                   <div className="step-icon">
                     <i className="fas fa-desktop"></i>
                   </div>
                   <div className="step-badge">02</div>
                 </div>
                 <div className="step-card">
                   <h3>Administrators Monitor</h3>
                   <p>Your team accesses the cloud-based Clean Software dashboard to monitor fill levels, usage patterns, and system health in real time.</p>
                 </div>
               </div>

               {/* Step 3 */}
               <div className="process-step">
                 <div className="step-icon-wrapper">
                   <div className="step-icon">
                     <i className="fas fa-hard-hat"></i>
                   </div>
                   <div className="step-badge">03</div>
                 </div>
                 <div className="step-card">
                   <h3>Utility Staff Collect</h3>
                   <p>When bins reach capacity, authorized utility staff are dispatched to service them. Collection is handled exclusively by trained personnel.</p>
                 </div>
               </div>

               {/* Step 4 */}
               <div className="process-step">
                 <div className="step-icon-wrapper">
                   <div className="step-icon">
                     <i className="fas fa-chart-bar"></i>
                   </div>
                   <div className="step-badge">04</div>
                 </div>
                 <div className="step-card">
                   <h3>Track & Optimize</h3>
                   <p>Comprehensive analytics and reporting tools provide full visibility into program performance, cost efficiency, and environmental impact.</p>
                 </div>
               </div>
            </div>

            {/* Access Alert Box */}
            <div className="access-alert">
              <div className="access-alert-icon">
                <i className="fas fa-laptop"></i>
              </div>
              <div className="access-alert-content">
                <h4>Administrator and staff access only.</h4>
                <p>The Clean Software platform is accessible exclusively to authorized organizational personnel. All monitoring, reporting, and collection management is handled through secure web-based dashboards.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Why SmartWaste Section */}
        <section className="why-smartwaste">
          <div className="why-sw-container">
            {/* Left Content */}
            <div className="why-sw-left">
              <div className="why-sw-eyebrow">WHY SMARTWASTE</div>
              <h2 className="why-sw-title">
                Enterprise Waste Management.<br/>
                <span className="why-sw-title-faded">Without the Enterprise Price Tag.</span>
              </h2>
              
              <div className="why-sw-text">
                <p style={{marginBottom: '1rem'}}>
                  Organizations worldwide are adopting smart infrastructure — from smart buildings to smart campuses. Waste management is no exception. 
                  SmartWaste brings the same connected intelligence to composting and 
                  waste collection that organizations expect from modern enterprise systems.
                </p>
                <p>
                  And unlike other smart bin solutions that charge a premium for the "smart"
                  label, SmartWaste is built to be accessible to organizations of all sizes. More 
                  affordable upfront. Lower cost to operate. Same — or better — operational 
                  results.
                </p>
              </div>

              <div className="why-sw-cta-box">
                <i className="fas fa-dollar-sign why-sw-cta-icon"></i>
                <div className="why-sw-cta-text">
                  <strong>Up to 40% less than comparable smart bins</strong>
                  <span style={{opacity: 0.8, fontSize: '0.9rem'}}>No hidden fees. No long-term lock-in required.</span>
                </div>
              </div>
            </div>

            {/* Right Cards Grid */}
            <div className="why-sw-right">
              <div className="why-sw-grid">
                {/* Card 1 */}
                <div className="why-sw-card">
                  <div className="why-sw-card-icon"><i className="fas fa-dollar-sign"></i></div>
                  <h3 className="why-sw-card-title">More Affordable Than the Competition</h3>
                  <p className="why-sw-card-text">
                    SmartWaste bins cost significantly less than other smart waste solutions on the market — without cutting corners on sensors, connectivity, or build quality.
                  </p>
                </div>

                {/* Card 2 */}
                <div className="why-sw-card">
                  <div className="why-sw-card-icon"><i className="fas fa-bolt"></i></div>
                  <h3 className="why-sw-card-title">Innovation That Actually Works</h3>
                  <p className="why-sw-card-text">
                    Smart technology is reshaping how organizations operate. SmartWaste brings that innovation to waste management — one of the last sectors to modernize.
                  </p>
                </div>

                {/* Card 3 */}
                <div className="why-sw-card">
                  <div className="why-sw-card-icon"><i className="fas fa-shield-alt"></i></div>
                  <h3 className="why-sw-card-title">No Performance Trade-Offs</h3>
                  <p className="why-sw-card-text">
                    Budget-friendly doesn't mean basic. Every SmartWaste bin includes real-time fill sensors, secure access control, and full software integration.
                  </p>
                </div>

                {/* Card 4 */}
                <div className="why-sw-card">
                  <div className="why-sw-card-icon"><i className="fas fa-building"></i></div>
                  <h3 className="why-sw-card-title">Built for Organizational Efficiency</h3>
                  <p className="why-sw-card-text">
                    Our mission is to streamline waste management operations for municipalities, universities, and enterprises. SmartWaste reduces administrative overhead and operational complexity.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Getting Started Section */}
        <section className="getting-started">
          <div className="getting-started-container">
            <span className="getting-started-eyebrow">GETTING STARTED</span>
            <h2 className="getting-started-title">From Inquiry to Launch in Three Steps</h2>
            <p className="getting-started-subtitle">
              Starting a SmartWaste program is straightforward. No lengthy procurement cycles,
              no complex infrastructure requirements.
            </p>

            <div className="getting-started-steps">
              {/* Step 1 */}
              <div className="getting-started-step">
                <div className="gs-step-header">
                  <div className="gs-step-icon-box">
                    <i className="far fa-file-alt"></i>
                  </div>
                  <span className="gs-step-label">STEP 1</span>
                </div>
                <h3 className="gs-step-title">Tell Us About Your Organization</h3>
                <p className="gs-step-desc">
                  Fill out a short intake form describing your facility, service area, and program goals. No commitment required.
                </p>
              </div>

              {/* Step 2 */}
              <div className="getting-started-step">
                <div className="gs-step-header">
                  <div className="gs-step-icon-box">
                    <i className="far fa-calendar-check"></i>
                  </div>
                  <span className="gs-step-label">STEP 2</span>
                </div>
                <h3 className="gs-step-title">Get a Custom Proposal</h3>
                <p className="gs-step-desc">
                  Our team will design a program plan tailored to your organization — including bin placement, staffing requirements, and software configuration.
                </p>
              </div>

              {/* Step 3 */}
              <div className="getting-started-step">
                <div className="gs-step-header">
                  <div className="gs-step-icon-box">
                    <i className="fas fa-rocket"></i>
                  </div>
                  <span className="gs-step-label">STEP 3</span>
                </div>
                <h3 className="gs-step-title">Launch in Weeks</h3>
                <p className="gs-step-desc">
                  Once approved, SmartWaste handles installation and onboarding. Most programs are fully operational within 2–4 weeks.
                </p>
              </div>
            </div>
          </div>
        </section>


      </main>

      <LandingFooter />
    </div>
  )
}
