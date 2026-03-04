import React, { useLayoutEffect, useState } from 'react'
import '../styles/vendor/landing-page.css'
import '../styles/vendor/support.css'
import LandingFooter from '../components/LandingFooter'
import SmartChatbot from '../components/SmartChatbot'

export default function Support() {
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  const faqData = [
    {
      question: "How quickly can we get SmartWaste deployed across our facilities?",
      answer: "Most organizations are fully operational within 2-4 weeks. Our project team handles sensor provisioning, dashboard configuration, and staff onboarding. For large-scale municipal deployments, we offer a phased rollout plan."
    },
    {
      question: "What happens if a smart bin sensor goes offline?",
      answer: "If a sensor goes offline, our system immediately flags it in your dashboard and sends an alert. Our platform will attempt to reconnect automatically. If the issue persists, our support team will remotely diagnose it or dispatch a technician."
    },
    {
      question: "Can SmartWaste integrate with our existing ERP or facility management system?",
      answer: "Yes, SmartWaste offers robust APIs and pre-built integrations for most major ERP and facility management platforms to ensure seamless data flow and operational continuity."
    },
    {
      question: "Is our waste data secure and compliant with data protection regulations?",
      answer: "Absolutely. We employ enterprise-grade encryption and comply with major data protection regulations including GDPR and CCPA to ensure your organization's data is fully secure."
    },
    {
      question: "What support is included in our subscription plan?",
      answer: "All subscription plans include 24/7 monitoring, access to our comprehensive knowledge base, and standard email support. Premium plans offer dedicated account managers and priority response times."
    }
  ];

  const toggleFaq = (index) => {
    setOpenFaqIndex(openFaqIndex === index ? -1 : index);
  };

  useLayoutEffect(() => {
    document.body.classList.add('landing-page')
    return () => {
      document.body.classList.remove('landing-page')
    }
  }, [])

  return (
    <div>
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
                <a href="/product" className="landing-nav__link">Product</a>
                <a href="/support" className="landing-nav__link active">Support</a>
                <a href="/solutions" className="landing-nav__link">Solutions</a>
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
            <section className="pricing-hero" style={{ 
                padding: '140px 20px 100px', 
                backgroundColor: 'transparent', 
                position: 'relative',
                background: 'radial-gradient(ellipse at top center, rgba(18, 183, 106, 0.15) 0%, rgba(18, 183, 106, 0.05) 40%, transparent 70%)'
            }}>
                <div className="pricing-hero__content">
                    <div className="pricing-hero__label" style={{ color: '#027a5e', fontWeight: 'bold', letterSpacing: '0.1em', marginBottom: '24px' }}>SUPPORT</div>
                    <h1 className="pricing-hero__title" style={{ fontSize: '3.5rem', lineHeight: '1.2', fontWeight: '800', color: '#131f2f', marginBottom: '20px' }}>
                        Real support, from real<br/>experts<br/>anytime you need it
                    </h1>
                    <p className="pricing-hero__subtitle" style={{ fontSize: '1.125rem', color: '#687b8d', maxWidth: '600px', margin: '0 auto', lineHeight: '1.6' }}>
                        Our team is here for you 24/7, ready to help you solve<br/>problems, scale faster, and stay on track.
                    </p>
                </div>
            </section>

            {/* Team Grid */}
            <section className="pricing-team" style={{ padding: '80px 20px', backgroundColor: '#ffffff', textAlign: 'center' }}>
                <h2 className="section-title" style={{ marginBottom: '60px' }}>
                    Meet our support team
                </h2>
                <div className="pricing-team__grid">
                    {/* Member 1 */}
                    <div className="team-member">
                        <img src="https://image2url.com/r2/default/images/1772603758506-29e74f23-093d-4c13-9d70-d81bda82c50e.jpg" alt="Carmelo Santiago" className="team-member__img" />
                        <div className="team-member__info">
                            <h4 className="team-member__name">Carmelo Santiago</h4>
                            <p className="team-member__role">Project Manager</p>
                        </div>
                    </div>
                    {/* Member 2 */}
                    <div className="team-member">
                        <img src="https://image2url.com/r2/default/images/1772603838487-79b2352d-ea99-4afa-93a3-bcc170da2f8e.jpg" alt="Mark Clent Bigayan" className="team-member__img" />
                        <div className="team-member__info">
                            <h4 className="team-member__name">MC Bigayan</h4>
                            <p className="team-member__role">IoT Engineer</p>
                        </div>
                    </div>
                    {/* Member 3 */}
                    <div className="team-member">
                        <img src="https://image2url.com/r2/default/images/1772603967964-4e67f934-0d48-46a7-8e86-44902be3c33a.jpg" alt="Greg Alop" className="team-member__img" />
                        <div className="team-member__info">
                            <h4 className="team-member__name">Greg Alop</h4>
                            <p className="team-member__role">Database Manager</p>
                        </div>
                    </div>
                    {/* Member 4 */}
                    <div className="team-member">
                        <img src="https://image2url.com/r2/default/images/1772604034683-b8d3d02a-d879-4ea2-b522-05fc563804c8.jpg" alt="Xingtian Terrencio" className="team-member__img" />
                        <div className="team-member__info">
                            <h4 className="team-member__name">Xingtian Terrencio</h4>
                            <p className="team-member__role">Frontend Specialist</p>
                        </div>
                    </div>
                    {/* Member 5 */}
                    <div className="team-member">
                        <img src="https://image2url.com/r2/default/images/1772604097867-c7f20ae4-e5fe-4c7c-8ea4-969c822ace69.jpg" alt="Raizen Termulo" className="team-member__img" />
                        <div className="team-member__info">
                            <h4 className="team-member__name">Raizen Termulo</h4>
                            <p className="team-member__role">Software Engineer</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Support FAQ Section */}
            <section className="support-faq">
                <div className="support-faq__container">
                    <div className="support-faq__header">
                        <span className="support-faq__label">BEFORE YOU DECIDE</span>
                        <h2 className="support-faq__title">What organizations ask us before getting started</h2>
                        <p className="support-faq__subtitle">
                            We've answered the questions that matter most to municipalities, campuses, and enterprises evaluating a cloud-based waste management system.
                        </p>
                    </div>

                    <div className="support-faq__grid">
                        <div className="support-faq__card">
                            <div className="support-faq__icon">
                                <i className="far fa-building"></i>
                            </div>
                            <h3 className="support-faq__card-title">Can it handle multiple sites or facilities?</h3>
                            <p className="support-faq__card-desc">
                                Yes. SmartWaste is built for multi-site operations. A single dashboard gives you visibility across all locations, with role-based access controls and centralized reporting for your entire organization.
                            </p>
                        </div>

                        <div className="support-faq__card">
                            <div className="support-faq__icon">
                                <i className="fas fa-plug"></i>
                            </div>
                            <h3 className="support-faq__card-title">Does it connect with our existing systems?</h3>
                            <p className="support-faq__card-desc">
                                SmartWaste provides a REST API and pre-built connectors for common ERP, CMMS, and facility management platforms. Our integrations team will map your data flows and ensure a seamless setup.
                            </p>
                        </div>

                        <div className="support-faq__card">
                            <div className="support-faq__icon">
                                <i className="fas fa-chart-bar"></i>
                            </div>
                            <h3 className="support-faq__card-title">What insights does the data actually provide?</h3>
                            <p className="support-faq__card-desc">
                                You get real-time fill levels, collection frequency trends, cost-per-pickup breakdowns, waste diversion rates, and carbon impact estimates — all exportable for internal reporting or regulatory compliance.
                            </p>
                        </div>

                        <div className="support-faq__card">
                            <div className="support-faq__icon">
                                <i className="fas fa-university"></i>
                            </div>
                            <h3 className="support-faq__card-title">Is it suitable for public institutions?</h3>
                            <p className="support-faq__card-desc">
                                SmartWaste is purpose-built for municipalities, universities, and regulated environments. It is fully GDPR-compliant, supports data residency requirements, and meets public sector procurement standards.
                            </p>
                        </div>

                        <div className="support-faq__card">
                            <div className="support-faq__icon">
                                <i className="fas fa-graduation-cap"></i>
                            </div>
                            <h3 className="support-faq__card-title">How do we get our staff up to speed?</h3>
                            <p className="support-faq__card-desc">
                                We provide guided onboarding sessions, a video tutorial library, in-app contextual help, and a dedicated support contact for your team. Most organizations are fully operational within two to four weeks.
                            </p>
                        </div>

                        <div className="support-faq__card">
                            <div className="support-faq__icon">
                                <i className="fas fa-wrench"></i>
                            </div>
                            <h3 className="support-faq__card-title">What happens if something goes wrong?</h3>
                            <p className="support-faq__card-desc">
                                The platform monitors your sensor network 24/7 and flags issues automatically. Our support team can remotely diagnose most problems within hours, and a field technician can be dispatched for hardware issues.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* New Accordion FAQ Section */}
            <section className="faq-accordion-section" style={{
                padding: '80px 20px',
                backgroundColor: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '40px', maxWidth: '600px' }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#027a5e',
                        fontWeight: '600',
                        fontSize: '14px',
                        marginBottom: '16px'
                    }}>
                        <i className="far fa-comment-dots"></i>
                        <span>FAQ</span>
                    </div>
                    <h2 style={{
                        fontSize: '32px',
                        fontWeight: '700',
                        color: '#101828',
                        margin: '0 0 16px'
                    }}>Frequently asked questions</h2>
                    <p style={{
                        fontSize: '16px',
                        color: '#667085',
                        lineHeight: '1.5',
                        margin: '0'
                    }}>Quick answers to the questions we hear most from organizations getting started with SmartWaste.</p>
                </div>

                <div style={{
                    width: '100%',
                    maxWidth: '800px',
                    display: 'flex',
                    flexDirection: 'column',
                    border: '1px solid #eaecf0',
                    borderRadius: '12px',
                    overflow: 'visible',
                    backgroundColor: '#ffffff'
                }}>
                    {faqData.map((faq, index) => {
                        const isActive = openFaqIndex === index;
                        return (
                            <div key={index} style={{
                                backgroundColor: isActive ? '#f0fdf4' : '#ffffff',
                                border: isActive ? '1px solid #101828' : 'none',
                                borderBottom: (!isActive && index < faqData.length - 1) ? '1px solid #eaecf0' : (isActive ? '1px solid #101828' : 'none'),
                                borderRadius: isActive ? '8px' : '0',
                                position: 'relative',
                                zIndex: isActive ? 10 : 1,
                                boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                                margin: isActive ? '-1px' : '0',
                                transition: 'all 0.2s ease',
                            }}>
                                <button
                                    onClick={() => toggleFaq(index)}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '24px',
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        fontSize: '16px',
                                        fontWeight: '600',
                                        color: isActive ? '#027a5e' : '#101828',
                                        paddingBottom: isActive ? '12px' : '24px',
                                        fontFamily: 'inherit',
                                        transition: 'padding 0.3s ease, color 0.3s ease'
                                    }}
                                >
                                    <span>{faq.question}</span>
                                    <i
                                        className="fas fa-chevron-down"
                                        style={{
                                            color: isActive ? '#027a5e' : '#98a2b3',
                                            transform: isActive ? 'rotate(180deg)' : 'rotate(0deg)',
                                            transition: 'transform 0.3s ease, color 0.3s ease'
                                        }}
                                    ></i>
                                </button>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateRows: isActive ? '1fr' : '0fr',
                                    transition: 'grid-template-rows 0.3s ease-in-out'
                                }}>
                                    <div style={{ overflow: 'hidden' }}>
                                        <div style={{
                                            padding: '0 24px 24px',
                                            color: '#475467',
                                            fontSize: '15px',
                                            lineHeight: '1.6',
                                            opacity: isActive ? 1 : 0,
                                            transition: 'opacity 0.3s ease-in-out',
                                            transitionDelay: isActive ? '0.1s' : '0s'
                                        }}>
                                            {faq.answer}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div style={{
                    marginTop: '32px',
                    fontSize: '15px',
                    color: '#667085'
                }}>
                    Still have questions? <a href="/support" style={{
                        color: '#027a5e',
                        fontWeight: '600',
                        textDecoration: 'none'
                    }}>Contact our support team &rarr;</a>
                </div>
                <style>{`
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(-4px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `}</style>
            </section>

        </main>

        {/* Footer */}
        <LandingFooter />

        <SmartChatbot />
    </div>
  )
}
