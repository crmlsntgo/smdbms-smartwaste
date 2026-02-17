import React, { useLayoutEffect } from 'react'
import '../styles/vendor/landing-page.css'
import LandingFooter from '../components/LandingFooter'

export default function Landing() {
  useLayoutEffect(() => {
    document.body.classList.add('landing-page')
    return () => {
      document.body.classList.remove('landing-page')
    }
  }, [])

  return (
    <div>
        {/* Background Shapes */}
        <div className="bg-animation">
            <div className="bg-shape bg-shape-1"></div>
            <div className="bg-shape bg-shape-2"></div>
            <div className="bg-shape bg-shape-3"></div>
        </div>

        {/* Header Navigation */}
        <header className="landing-nav">
            <div className="landing-nav__container">
            <a href="#" className="landing-nav__logo">
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
                <a href="#" className="landing-nav__link">Services</a>
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

        {/* Main Content */}
  <main className="landing-main">
    <div className="hero-container">
      {/* Left Content */}
      <div className="hero-content">
        <div className="hero-badge">
          <i className="fas fa-sparkles"></i> Smart Waste Management
        </div>
        
        <h1 className="hero-title">
          Waste<br />
          <span className="serif-text">management</span><br />
          <span className="serif-text text-green">reimagined.</span>
        </h1>
        
        <p className="hero-subtitle">
          Transform your waste disposal with intelligent monitoring, real-time analytics, and automated collection scheduling.
        </p>

        <div className="hero-actions">
          <a href="/register" className="btn-primary">
            Request Demo <i className="fas fa-arrow-right"></i>
          </a>
          
        </div>

        <div className="hero-stats">
          <div className="stat-item">
            <span className="stat-val">98%</span>
            <span className="stat-label">Efficiency Rate</span>
          </div>
          <div className="stat-item">
            <span className="stat-val">24/7</span>
            <span className="stat-label">Monitoring</span>
          </div>
          <div className="stat-item">
            <span className="stat-val">500+</span>
            <span className="stat-label">Active Users</span>
          </div>
        </div>
      </div>

      {/* Right Image/Visual */}
      <div className="hero-visual">
         {/* This represents the dashboard screenshot from the design */}
         <div className="dashboard-preview-card">
             <img src="https://placehold.co/800x500/e0f2f1/00695c?text=Dashboard+Preview" alt="Smart Waste Dashboard" className="hero-img" />
             
             {/* Floating Badges (auto-swap while moving) */}
             <div className="floating-badge-wrapper" aria-hidden="false">
               <div className="floating-badge floating-badge--primary" role="status">
                 <div className="fb-icon">
                   <i className="fas fa-chart-bar"></i>
                 </div>
                 <div className="fb-content">
                   <div className="fb-title">Real-time Analytics</div>
                   <div className="fb-sub">Track waste levels instantly</div>
                 </div>
               </div>

               <div className="floating-badge floating-badge--alt" role="status" aria-hidden="true">
                 <div className="fb-icon fb-icon--alt">
                   <i className="fas fa-bell"></i>
                 </div>
                 <div className="fb-content">
                   <div className="fb-title">Smart Alerts</div>
                   <div className="fb-sub">Instant bin alerts</div>
                 </div>
               </div>
             </div>
         </div>
      </div>
    </div>
  </main>

  {/* Our Impact Section */}
  <section className="impact-section" id="impact">
    <div className="impact-container">
      <div className="section-header">
        <h2 className="section-title">Our Impact</h2>
        <p className="section-subtitle">Making a difference in waste management across different sectors</p>
      </div>

      <div className="impact-stats">
        <div className="impact-stat-card">
          <div className="impact-stat-icon">
            <i className="fas fa-building"></i>
          </div>
          <div className="impact-stat-number">50+</div>
          <div className="impact-stat-label">Office Buildings</div>
        </div>

        <div className="impact-stat-card">
          <div className="impact-stat-icon">
            <i className="fas fa-graduation-cap"></i>
          </div>
          <div className="impact-stat-number">25+</div>
          <div className="impact-stat-label">Schools & Universities</div>
        </div>

        <div className="impact-stat-card">
          <div className="impact-stat-icon">
            <i className="fas fa-users"></i>
          </div>
          <div className="impact-stat-number">10K+</div>
          <div className="impact-stat-label">Daily Users</div>
        </div>

        <div className="impact-stat-card">
          <div className="impact-stat-icon">
            <i className="fas fa-clock"></i>
          </div>
          <div className="impact-stat-number">60%</div>
          <div className="impact-stat-label">Waste Reduction</div>
        </div>
      </div>

      {/* Intelligent Waste Management Solution */}
      <div className="solution-box">
        <h3 className="solution-title">Intelligent Waste Management Solution</h3>
        <p className="solution-description">The Smart Dust-bin Monitoring System is an IoT-based solution designed to improve waste management efficiency. By using ultrasonic sensors and a cloud-based dashboard, the system provides real-time monitoring, timely alerts, and user-friendly tools to help maintain cleaner surroundings.</p>
        
        <div className="solution-features">
          <div className="solution-feature">
            <div className="solution-feature-icon">
              <i className="fas fa-cloud"></i>
            </div>
            <div className="solution-feature-content">
              <h4 className="solution-feature-title">Cloud</h4>
              <p className="solution-feature-text">Real-time monitoring</p>
            </div>
          </div>

          <div className="solution-feature">
            <div className="solution-feature-icon">
              <i className="fas fa-wifi"></i>
            </div>
            <div className="solution-feature-content">
              <h4 className="solution-feature-title">IoT Enabled</h4>
              <p className="solution-feature-text">Smart connectivity</p>
            </div>
          </div>

          <div className="solution-feature">
            <div className="solution-feature-icon">
              <i className="fas fa-bell"></i>
            </div>
            <div className="solution-feature-content">
              <h4 className="solution-feature-title">Smart Alerts</h4>
              <p className="solution-feature-text">Timely notifications</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  {/* Mission & Vision Section */}
  <section className="mission-vision-section" id="about">
    <div className="mission-vision-container">
      <div className="mission-card">
        <div className="mission-icon">
          <i className="fas fa-bullseye"></i>
        </div>
        <h3 className="mission-title">Our Mission</h3>
        <p className="mission-text">To provide an affordable, scalable, and user-friendly smart waste monitoring solution that promotes cleanliness and efficiency in schools, offices, and communities.</p>
      </div>

      <div className="vision-card">
        <div className="vision-icon">
          <i className="fas fa-eye"></i>
        </div>
        <h3 className="vision-title">Our Vision</h3>
        <p className="vision-text">To contribute to sustainable and smarter communities through innovation in waste management, creating cleaner environments and more efficient resource utilization.</p>
      </div>
    </div>
  </section>

  {/* Key Features Section */}
  <section className="features-section" id="features">
    <div className="features-container">
      <div className="section-header">
        <h2 className="section-title">Key Features</h2>
        <p className="section-subtitle">Our smart waste management system comes with powerful features designed to make waste management more efficient.</p>
      </div>

      <div className="features-grid">
        <div className="feature-card">
          <div className="feature-icon">
            <i className="fas fa-chart-bar"></i>
          </div>
          <h4 className="feature-title">Fill Level Monitoring</h4>
          <p className="feature-description">Real-time tracking of waste bin capacity</p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">
            <i className="fas fa-bell"></i>
          </div>
          <h4 className="feature-title">Smart Alerts</h4>
          <p className="feature-description">Get notified when bins need attention</p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">
            <i className="fas fa-chart-pie"></i>
          </div>
          <h4 className="feature-title">Analytics Dashboard</h4>
          <p className="feature-description">Insights and reporting for optimization</p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">
            <i className="fas fa-calendar-alt"></i>
          </div>
          <h4 className="feature-title">Scheduling</h4>
          <p className="feature-description">Optimize collection routes and timing</p>
        </div>
      </div>
    </div>
  </section>

  {/* Footer */}
  <LandingFooter />
    </div>
  )
}
