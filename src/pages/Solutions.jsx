import React, { useLayoutEffect, useState } from 'react'
import '../styles/vendor/landing-page.css'
import '../styles/vendor/solutions.css'
import LandingFooter from '../components/LandingFooter'

export default function Solutions() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useLayoutEffect(() => {
    document.body.classList.add('landing-page')
    return () => {
      document.body.classList.remove('landing-page')
    }
  }, [])

  const solutions = [
    {
      title: "Municipalities",
      description: "From small towns to major metropolitan areas, SmartWaste transforms communities with configurable solutions that meet their unique needs.",
      image: "https://upload.wikimedia.org/wikipedia/en/thumb/b/b0/Caloocan_City_Hall%2C_view_from_commercial_complex_%28Grace_Park%2C_Caloocan%3B_03-21-2021%29.jpg/1280px-Caloocan_City_Hall%2C_view_from_commercial_complex_%28Grace_Park%2C_Caloocan%3B_03-21-2021%29.jpg?_=20210326213552",
    },
    {
      title: "Universities",
      description: "SmartWaste enables colleges and universities to elevate their spaces for a better on-campus experience, promoting sustainability and cleanliness.",
      image: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Novaliches_District_of_Caloocan_03.jpg/960px-Novaliches_District_of_Caloocan_03.jpg",
    },
    {
      title: "Industries",
      description: "The SmartWaste solution can reduce collections by over 80%. Our smart, clean-connected bins send alerts when they're full.",
      image: "https://upload.wikimedia.org/wikipedia/commons/f/f6/20110425_Amsterdam_65_IBM_building.JPG",
    }
  ];

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
                <a href="/product" className="landing-nav__link">Product</a>
                <a href="/support" className="landing-nav__link">Support</a>
                <a href="/solutions" className="landing-nav__link active">Solutions</a>
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
            {/* Hero Section */}
            <section className="pricing-hero" style={{ 
                padding: '140px 20px 100px', 
                backgroundColor: 'transparent', 
                position: 'relative',
                textAlign: 'center',
                background: 'radial-gradient(ellipse at top center, rgba(18, 183, 106, 0.15) 0%, rgba(18, 183, 106, 0.05) 40%, transparent 70%)'
            }}>
                <div className="pricing-hero__content">
                    <div className="pricing-hero__label" style={{ color: '#027a5e', fontWeight: 'bold', letterSpacing: '0.1em', marginBottom: '24px' }}>SOLUTIONS</div>
                    <h1 className="pricing-hero__title" style={{ fontSize: '3.5rem', lineHeight: '1.2', fontWeight: '800', color: '#131f2f', marginBottom: '20px' }}>
                        All SmartWaste Solutions
                    </h1>
                    <p className="pricing-hero__subtitle" style={{ fontSize: '1.125rem', color: '#687b8d', maxWidth: '800px', margin: '0 auto', lineHeight: '1.6' }}>
                        SmartWaste is transforming cities, campuses and businesses around the world from the ground up.<br />
                        We can deploy a configuration of trash cans, recycling and compost bins with accessories to meet the needs of any public space.
                    </p>
                </div>
            </section>

            {/* Solutions Grid */}
            <section className="solutions-grid">
                {solutions.map((item, index) => (
                    <div className="solution-card" key={index}>
                        <img src={item.image} alt={item.title} className="solution-img" />
                        <div className="solution-content">
                            <h3 className="solution-title">{item.title}</h3>
                            <p className="solution-desc">{item.description}</p>
                            <a href="#" className="solution-btn">Find out more</a>
                        </div>
                    </div>
                ))}
            </section>

            {/* Added Section: Problems We Solve */}
            <section className="problems-we-solve" style={{ padding: '80px 20px', backgroundColor: '#ffffff' }}>
                <style>{`
                    .problems-we-solve-header {
                        text-align: center;
                        margin-bottom: 60px;
                    }
                    .problems-we-solve-title {
                        color: #1a365d;
                        font-size: 2.5rem;
                        font-weight: 700;
                        margin-bottom: 15px;
                    }
                    .problems-we-solve-subtitle {
                        color: #4a5568;
                        font-size: 1.1rem;
                        max-width: 800px;
                        margin: 0 auto;
                        line-height: 1.6;
                    }
                    .problems-grid {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 40px;
                        max-width: 1200px;
                        margin: 0 auto;
                    }
                    @media (max-width: 900px) {
                        .problems-grid {
                            grid-template-columns: 1fr;
                        }
                    }
                    .problem-card-wrapper {
                        display: flex;
                        flex-direction: column;
                        transition: transform 0.3s ease, box-shadow 0.3s ease;
                        border-radius: 12px;
                        box-shadow: 0 4px 6px rgba(0,0,0,0.05);
                        cursor: default;
                    }
                    .problem-card-wrapper:hover {
                        transform: translateY(-5px);
                        box-shadow: 0 12px 20px rgba(0,0,0,0.1);
                    }
                    .problem-top {
                        background-color: #fff5f5;
                        padding: 30px;
                        border-top-left-radius: 12px;
                        border-top-right-radius: 12px;
                        position: relative;
                        flex: 1;
                        border: 1px solid #fee2e2;
                        border-bottom: none;
                    }
                    .problem-bottom {
                        background-color: #f0fdf4;
                        padding: 30px;
                        border-bottom-left-radius: 12px;
                        border-bottom-right-radius: 12px;
                        flex: 1;
                        border: 1px solid #dcfce7;
                        border-top: none;
                        padding-top: 40px;
                    }
                    .problem-arrow {
                        position: absolute;
                        bottom: -15px;
                        left: 50%;
                        transform: translateX(-50%);
                        width: 30px;
                        height: 30px;
                        background: #ffffff;
                        border: 1px solid #e2e8f0;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 10;
                        color: #a0aec0;
                        font-size: 0.8rem;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                    }
                    .card-header {
                        display: flex;
                        align-items: center;
                        margin-bottom: 15px;
                    }
                    .icon-wrapper-red {
                        width: 36px;
                        height: 36px;
                        border-radius: 50%;
                        background-color: #fed7d7;
                        color: #c53030;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-right: 15px;
                        font-size: 1.1rem;
                    }
                    .icon-wrapper-green {
                        width: 36px;
                        height: 36px;
                        border-radius: 50%;
                        background-color: #c6f6d5;
                        color: #2f855a;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-right: 15px;
                        font-size: 1.1rem;
                    }
                    .title-red {
                        color: #9b2c2c;
                        font-weight: 600;
                        font-size: 1.25rem;
                        margin: 0;
                    }
                    .title-green {
                        color: #276749;
                        font-weight: 600;
                        font-size: 1.25rem;
                        margin: 0;
                    }
                    .desc-red {
                        color: #c53030;
                        font-size: 0.95rem;
                        line-height: 1.5;
                        margin: 0;
                    }
                    .desc-green {
                        color: #2f855a;
                        font-size: 0.95rem;
                        line-height: 1.5;
                        margin: 0;
                    }
                `}</style>
                <div className="problems-we-solve-header">
                    <h2 className="problems-we-solve-title">Problems We Solve</h2>
                    <p className="problems-we-solve-subtitle">
                        Every SmartWaste solution is engineered to address the real challenges facing waste management teams today
                    </p>
                </div>

                <div className="problems-grid">
                    {/* Item 1 */}
                    <div className="problem-card-wrapper">
                        <div className="problem-top">
                            <div className="card-header">
                                <div className="icon-wrapper-red">
                                    <i className="fas fa-exclamation-triangle"></i>
                                </div>
                                <h3 className="title-red">Overflowing Bins &amp; Litter Complaints</h3>
                            </div>
                            <p className="desc-red">
                                Bins overflow between scheduled pickups, creating unsightly litter, odor issues, and a flood of public complaints.
                            </p>
                            <div className="problem-arrow">
                                <i className="fas fa-arrow-down"></i>
                            </div>
                        </div>
                        <div className="problem-bottom">
                            <div className="card-header">
                                <div className="icon-wrapper-green">
                                    <i className="fas fa-wifi"></i>
                                </div>
                                <h3 className="title-green">Smart Fill-Level Sensors</h3>
                            </div>
                            <p className="desc-green">
                                IoT-enabled sensors monitor bin capacity in real-time and trigger collection alerts at custom thresholds — before overflow ever happens.
                            </p>
                        </div>
                    </div>

                    {/* Item 2 */}
                    <div className="problem-card-wrapper">
                        <div className="problem-top">
                            <div className="card-header">
                                <div className="icon-wrapper-red">
                                    <i className="fas fa-route"></i>
                                </div>
                                <h3 className="title-red">Inefficient Manual Inspections</h3>
                            </div>
                            <p className="desc-red">
                                Fixed schedules mean staff visit half-empty bins while others require immediate attention. Wasted time, wasted labor, wasted budget.
                            </p>
                            <div className="problem-arrow">
                                <i className="fas fa-arrow-down"></i>
                            </div>
                        </div>
                        <div className="problem-bottom">
                            <div className="card-header">
                                <div className="icon-wrapper-green">
                                    <i className="fas fa-cogs"></i>
                                </div>
                                <h3 className="title-green">Data-Driven Workflow Optimization</h3>
                            </div>
                            <p className="desc-green">
                                Dynamic dashboard analyzes fill data across your entire facility, generating the most efficient collection tasks daily.
                            </p>
                        </div>
                    </div>

                    {/* Item 3 */}
                    <div className="problem-card-wrapper">
                        <div className="problem-top">
                            <div className="card-header">
                                <div className="icon-wrapper-red">
                                    <i className="fas fa-eye-slash"></i>
                                </div>
                                <h3 className="title-red">Zero Visibility Into Waste Operations</h3>
                            </div>
                            <p className="desc-red">
                                No data on fill rates, collection frequency, or diversion metrics makes it impossible to plan, budget, or report accurately.
                            </p>
                            <div className="problem-arrow">
                                <i className="fas fa-arrow-down"></i>
                            </div>
                        </div>
                        <div className="problem-bottom">
                            <div className="card-header">
                                <div className="icon-wrapper-green">
                                    <i className="fas fa-th-large"></i>
                                </div>
                                <h3 className="title-green">Cloud Management Dashboard</h3>
                            </div>
                            <p className="desc-green">
                                A centralized platform with real-time analytics, historical trends, exportable reports, and customizable KPI tracking for every location.
                            </p>
                        </div>
                    </div>

                    {/* Item 4 */}
                    <div className="problem-card-wrapper">
                        <div className="problem-top">
                            <div className="card-header">
                                <div className="icon-wrapper-red">
                                    <i className="fas fa-trash-alt"></i>
                                </div>
                                <h3 className="title-red">Unsanitary Overflow &amp; Odors</h3>
                            </div>
                            <p className="desc-red">
                                Unmonitored bins overflow rapidly during peak hours, creating hygiene hazards, foul odors, and damaging your facility's reputation.
                            </p>
                            <div className="problem-arrow">
                                <i className="fas fa-arrow-down"></i>
                            </div>
                        </div>
                        <div className="problem-bottom">
                            <div className="card-header">
                                <div className="icon-wrapper-green">
                                    <i className="fas fa-shield-alt"></i>
                                </div>
                                <h3 className="title-green">Proactive Capacity Management</h3>
                            </div>
                            <p className="desc-green">
                                Real-time monitoring ensures bins are emptied well before reaching capacity, maintaining pristine hygiene standards and aesthetic appeal.
                            </p>
                        </div>
                    </div>

                    {/* Item 5 */}
                    <div className="problem-card-wrapper">
                        <div className="problem-top">
                            <div className="card-header">
                                <div className="icon-wrapper-red">
                                    <i className="fas fa-dollar-sign"></i>
                                </div>
                                <h3 className="title-red">Unsustainable Operating Costs</h3>
                            </div>
                            <p className="desc-red">
                                Unnecessary truck dispatches, overtime labor, and reactive maintenance drain budgets that could fund improvements elsewhere.
                            </p>
                            <div className="problem-arrow">
                                <i className="fas fa-arrow-down"></i>
                            </div>
                        </div>
                        <div className="problem-bottom">
                            <div className="card-header">
                                <div className="icon-wrapper-green">
                                    <i className="fas fa-bell"></i>
                                </div>
                                <h3 className="title-green">Predictive Maintenance &amp; Automated Alerts</h3>
                            </div>
                            <p className="desc-green">
                                Smart diagnostics detect mechanical issues early. Automated scheduling eliminates unnecessary trips, cutting operational costs by up to 80%.
                            </p>
                        </div>
                    </div>

                    {/* Item 6 */}
                    <div className="problem-card-wrapper">
                        <div className="problem-top">
                            <div className="card-header">
                                <div className="icon-wrapper-red">
                                    <i className="fas fa-file-alt"></i>
                                </div>
                                <h3 className="title-red">Falling Short on Sustainability Mandates</h3>
                            </div>
                            <p className="desc-red">
                                Increasing regulatory pressure to improve recycling rates and reduce landfill waste, but no tools to measure or prove progress.
                            </p>
                            <div className="problem-arrow">
                                <i className="fas fa-arrow-down"></i>
                            </div>
                        </div>
                        <div className="problem-bottom">
                            <div className="card-header">
                                <div className="icon-wrapper-green">
                                    <i className="fas fa-leaf"></i>
                                </div>
                                <h3 className="title-green">Recycling &amp; Diversion Tracking</h3>
                            </div>
                            <p className="desc-green">
                                Stream-specific monitoring for trash, recycling, and compost with automated compliance reports and carbon footprint calculations.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* How SmartWaste Transforms Your Operations Section */}
            <section className="transform-process" style={{ padding: '80px 20px', backgroundColor: '#fafafa' }}>
                <style>{`
                    .transform-header {
                        text-align: center;
                        margin-bottom: 60px;
                    }
                    .transform-title {
                        color: #1a365d;
                        font-size: 2.25rem;
                        font-weight: 700;
                        margin-bottom: 20px;
                    }
                    .transform-subtitle {
                        color: #4a5568;
                        font-size: 1.1rem;
                        max-width: 800px;
                        margin: 0 auto;
                        line-height: 1.6;
                    }
                    .transform-steps-container {
                        max-width: 900px;
                        margin: 0 auto;
                        position: relative;
                    }
                    .transform-step {
                        display: flex;
                        align-items: stretch;
                        margin-bottom: 40px;
                        position: relative;
                    }
                    .transform-step:last-child {
                        margin-bottom: 0;
                    }
                    .transform-step-left {
                        position: relative;
                        width: 120px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        flex-shrink: 0;
                        padding-right: 20px;
                    }
                    .step-number-bg {
                        font-size: 4.5rem;
                        font-weight: 800;
                        line-height: 1;
                        opacity: 0.15;
                        margin-bottom: -20px;
                        z-index: 1;
                    }
                    .step-icon-circle {
                        width: 44px;
                        height: 44px;
                        border-radius: 50%;
                        background: #ffffff;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 2;
                        box-shadow: 0 4px 6px rgba(0,0,0,0.05);
                        font-size: 1.25rem;
                        margin-bottom: auto;
                    }
                    .step-line {
                        position: absolute;
                        top: 90px;
                        bottom: -50px;
                        left: 50%;
                        transform: translateX(-50%);
                        width: 2px;
                        background-image: linear-gradient(to bottom, #cbd5e0 50%, transparent 50%);
                        background-size: 2px 10px;
                        z-index: 0;
                    }
                    .transform-step:last-child .step-line {
                        display: none;
                    }
                    .transform-step-card {
                        background: #ffffff;
                        border: 1px solid #e2e8f0;
                        border-radius: 12px;
                        padding: 35px;
                        flex: 1;
                        transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
                    }
                    .transform-step-card:hover {
                        transform: translateY(-3px);
                        box-shadow: 0 10px 25px rgba(0,0,0,0.05);
                        border-color: #cbd5e0;
                    }
                    .step-card-title {
                        color: #1a365d;
                        font-size: 1.25rem;
                        font-weight: 700;
                        margin-top: 0;
                        margin-bottom: 15px;
                    }
                    .step-card-desc {
                        color: #4a5568;
                        font-size: 0.95rem;
                        line-height: 1.6;
                        margin-top: 0;
                        margin-bottom: 25px;
                    }
                    .step-list {
                        list-style: none;
                        padding: 0;
                        margin: 0;
                    }
                    .step-list-item {
                        display: flex;
                        align-items: flex-start;
                        margin-bottom: 12px;
                        color: #4a5568;
                        font-size: 0.9rem;
                        line-height: 1.4;
                    }
                    .step-list-item:last-child {
                        margin-bottom: 0;
                    }
                    .step-list-icon {
                        margin-right: 12px;
                        margin-top: 3px;
                        font-size: 1.1rem;
                    }
                    
                    .step-1-color { color: #4fd1c5; }
                    .step-2-color { color: #63b3ed; }
                    .step-3-color { color: #b794f4; }
                    .step-4-color { color: #68d391; }

                    @media (max-width: 768px) {
                        .transform-step-left {
                            width: 80px;
                        }
                        .step-number-bg {
                            font-size: 3rem;
                        }
                        .step-icon-circle {
                            width: 36px;
                            height: 36px;
                            font-size: 1rem;
                        }
                        .transform-step-card {
                            padding: 25px;
                        }
                    }
                `}</style>
                <div className="transform-header">
                    <h2 className="transform-title">How SmartWaste Transforms Your Operations</h2>
                    <p className="transform-subtitle">
                        From initial assessment to measurable results — a proven deployment process designed for municipalities, campuses, and businesses of every size
                    </p>
                </div>
                
                <div className="transform-steps-container">
                    {/* Step 1 */}
                    <div className="transform-step">
                        <div className="transform-step-left">
                            <div className="step-number-bg step-1-color">01</div>
                            <div className="step-icon-circle step-1-color">
                                <i className="fas fa-clipboard-check"></i>
                            </div>
                            <div className="step-line"></div>
                        </div>
                        <div className="transform-step-card">
                            <h3 className="step-card-title">Assess &amp; Design Your Solution</h3>
                            <p className="step-card-desc">
                                Our team conducts a comprehensive site assessment to understand your waste streams, traffic patterns, and operational goals. We then design a custom SmartWaste configuration tailored to your environment.
                            </p>
                            <ul className="step-list">
                                <li className="step-list-item">
                                    <i className="far fa-check-circle step-list-icon step-1-color"></i>
                                    <span>On-site waste audit and volume analysis</span>
                                </li>
                                <li className="step-list-item">
                                    <i className="far fa-check-circle step-list-icon step-1-color"></i>
                                    <span>Custom bin placement and configuration plan</span>
                                </li>
                                <li className="step-list-item">
                                    <i className="far fa-check-circle step-list-icon step-1-color"></i>
                                    <span>ROI projection and cost-savings forecast</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Step 2 */}
                    <div className="transform-step">
                        <div className="transform-step-left">
                            <div className="step-number-bg step-2-color">02</div>
                            <div className="step-icon-circle step-2-color">
                                <i className="fas fa-cog"></i>
                            </div>
                            <div className="step-line"></div>
                        </div>
                        <div className="transform-step-card">
                            <h3 className="step-card-title">Deploy Smart Infrastructure</h3>
                            <p className="step-card-desc">
                                We handle the complete installation — from positioning enclosed smart bins to mounting fill-level sensors and connecting everything to your cloud management dashboard.
                            </p>
                            <ul className="step-list">
                                <li className="step-list-item">
                                    <i className="far fa-check-circle step-list-icon step-2-color"></i>
                                    <span>Professional bin installation and sensor calibration</span>
                                </li>
                                <li className="step-list-item">
                                    <i className="far fa-check-circle step-list-icon step-2-color"></i>
                                    <span>Cloud platform setup with custom alert thresholds</span>
                                </li>
                                <li className="step-list-item">
                                    <i className="far fa-check-circle step-list-icon step-2-color"></i>
                                    <span>Staff training for operations and field teams</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Step 3 */}
                    <div className="transform-step">
                        <div className="transform-step-left">
                            <div className="step-number-bg step-3-color">03</div>
                            <div className="step-icon-circle step-3-color">
                                <i className="fas fa-wave-square"></i>
                            </div>
                            <div className="step-line"></div>
                        </div>
                        <div className="transform-step-card">
                            <h3 className="step-card-title">Monitor, Optimize &amp; Respond</h3>
                            <p className="step-card-desc">
                                With SmartWaste live, your team gains real-time visibility into every bin across every location. AI-driven route optimization and automated alerts replace guesswork with precision.
                            </p>
                            <ul className="step-list">
                                <li className="step-list-item">
                                    <i className="far fa-check-circle step-list-icon step-3-color"></i>
                                    <span>Real-time fill-level monitoring across all sites</span>
                                </li>
                                <li className="step-list-item">
                                    <i className="far fa-check-circle step-list-icon step-3-color"></i>
                                    <span>Automated collection scheduling and route optimization</span>
                                </li>
                                <li className="step-list-item">
                                    <i className="far fa-check-circle step-list-icon step-3-color"></i>
                                    <span>Instant overflow prevention alerts to field crews</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Step 4 */}
                    <div className="transform-step">
                        <div className="transform-step-left">
                            <div className="step-number-bg step-4-color">04</div>
                            <div className="step-icon-circle step-4-color">
                                <i className="fas fa-chart-line"></i>
                            </div>
                            <div className="step-line"></div>
                        </div>
                        <div className="transform-step-card">
                            <h3 className="step-card-title">Measure Results &amp; Scale</h3>
                            <p className="step-card-desc">
                                Track your impact with comprehensive analytics — from collection cost savings to recycling diversion rates. Use data-driven insights to expand SmartWaste across additional locations.
                            </p>
                            <ul className="step-list">
                                <li className="step-list-item">
                                    <i className="far fa-check-circle step-list-icon step-4-color"></i>
                                    <span>Monthly performance reports with cost-savings tracking</span>
                                </li>
                                <li className="step-list-item">
                                    <i className="far fa-check-circle step-list-icon step-4-color"></i>
                                    <span>Sustainability metrics and compliance documentation</span>
                                </li>
                                <li className="step-list-item">
                                    <i className="far fa-check-circle step-list-icon step-4-color"></i>
                                    <span>Scalable expansion planning for new sites and regions</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Banner Section */}
            <section className="cta-banner-section" style={{ padding: '0 20px 80px', backgroundColor: '#ffffff' }}>
                <style>{`
                    .cta-banner-card {
                        background-color: #00897b;
                        border-radius: 16px;
                        padding: 60px 40px;
                        text-align: center;
                        max-width: 1000px;
                        margin: 0 auto;
                        color: #ffffff;
                        box-shadow: 0 20px 40px rgba(0, 137, 123, 0.15);
                    }
                    .cta-banner-title {
                        font-size: 2.25rem;
                        font-weight: 700;
                        margin-top: 0;
                        margin-bottom: 20px;
                        color: #ffffff;
                    }
                    .cta-banner-desc {
                        font-size: 1.1rem;
                        color: #e0f2f1;
                        max-width: 700px;
                        margin: 0 auto 40px;
                        line-height: 1.6;
                    }
                    .cta-buttons {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 20px;
                    }
                    .btn-cta-primary {
                        background-color: #ffffff;
                        color: #00897b !important;
                        padding: 14px 32px;
                        border-radius: 50px;
                        font-weight: 600;
                        font-size: 1.05rem;
                        text-decoration: none;
                        transition: all 0.3s ease;
                        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                        border: 2px solid #ffffff;
                    }
                    .btn-cta-primary:hover {
                        background-color: #f7fafc;
                        transform: translateY(-2px);
                        box-shadow: 0 6px 12px rgba(0,0,0,0.15);
                    }
                    .btn-cta-secondary {
                        background-color: transparent;
                        color: #ffffff !important;
                        border: 2px solid #ffffff;
                        padding: 14px 32px;
                        border-radius: 50px;
                        font-weight: 600;
                        font-size: 1.05rem;
                        text-decoration: none;
                        transition: all 0.3s ease;
                    }
                    .btn-cta-secondary:hover {
                        background-color: rgba(255,255,255,0.1);
                        transform: translateY(-2px);
                    }
                    @media (max-width: 640px) {
                        .cta-buttons {
                            flex-direction: column;
                        }
                        .btn-cta-primary, .btn-cta-secondary {
                            width: 100%;
                            text-align: center;
                        }
                        .cta-banner-card {
                            padding: 40px 20px;
                        }
                        .cta-banner-title {
                            font-size: 1.75rem;
                        }
                    }
                `}</style>
                <div className="cta-banner-card">
                    <h2 className="cta-banner-title">Ready to See SmartWaste in Action?</h2>
                    <p className="cta-banner-desc">
                        Join hundreds of municipalities, universities, and businesses already transforming their waste operations with SmartWaste.
                    </p>
                    <div className="cta-buttons">
                        <a href="/support" className="btn-cta-primary">Schedule a Consultation</a>
                        <a href="/register" className="btn-cta-secondary">Request a Demo</a>
                    </div>
                </div>
            </section>
        </main>

        <LandingFooter />
    </div>
  )
}
