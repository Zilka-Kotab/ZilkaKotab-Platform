export interface TeamMember {
  slug: string;
  name: string;
  role: string;
  category: 'principal' | 'member';
  photo: string;
  email: string;
  linkedin?: string;
  shortBio: string; // kept for SEO/meta only
  education: string[];
  admissions: string[];
  awards?: string[];
  memberships?: string[];
  fullBio: string[];
  focus: string[];
}

// Ordered alphabetically by last name: Brill, Kali, Kotab, Rossi, Schroeder, Sessions, Zilka
export const team: TeamMember[] = [
  {
    slug: 'emma-brill',
    name: 'Emma Brill',
    role: 'Patent Paralegal',
    category: 'member',
    photo: '/images/team/brill.png',
    email: 'emma@zilkakotab.com',
    shortBio: 'Emma is a patent paralegal at Zilka-Kotab PC with extensive experience supporting patent prosecution across solo inventors, startups, academic researchers, and Fortune 500 companies.',
    education: [
      'University of California, Irvine',
    ],
    admissions: [],
    fullBio: [
      'Emma Brill is a patent paralegal at Zilka-Kotab PC with extensive experience supporting patent prosecution across a wide range of clients, including solo inventors, small start-ups, academic researchers, and Fortune 500 companies. At the direction of patent attorneys and agents, she prepares and files formal documents with the USPTO and foreign patent offices, and is an integral part of supporting patent professionals at the firm. She communicates with clients and inventors — both domestic and international — to ensure deadlines are met and guidelines are followed to the highest standard.',
      'Emma brings deep back-office expertise in docketing, billing, filing, and general office management, ensuring the smooth operation of patent workflows from inception to issuance. She is experienced in working across the full range of patent prosecution support needs and takes pride in keeping complex portfolios moving on time and with precision.',
      'Before transitioning to IP practice, Emma spent eight years in the biotechnology and pharmaceutical industries, gaining hands-on research experience in pharmacology, assay development, and recombinant protein expression — a scientific background that deepens her understanding of the inventions she helps protect and the clients she serves.',
    ],
    focus: [
      'USPTO & Foreign Filings',
      'Patent Docketing',
      'Client & Inventor Coordination',
      'Portfolio Administration',
    ],
  },
  {
    slug: 'alma-kali',
    name: 'Alma Kali',
    role: 'Patent Paralegal',
    category: 'member',
    photo: '/images/team/kali.png',
    email: 'alma@zilkakotab.com',
    shortBio: 'Alma is a patent paralegal at Zilka-Kotab PC with over a decade of experience in patent portfolio management, previously serving at Cypress Semiconductor and IBM.',
    education: [
      'BA, Political Theory, San José State University',
      'Paralegal Certificate, De Anza College',
    ],
    admissions: [],
    memberships: [
      'PCT Boot Camp Certified (2014)',
    ],
    fullBio: [
      'Alma Kali is a patent paralegal at Zilka-Kotab PC, bringing over a decade of dedicated experience in patent portfolio management. At the direction of patent attorneys and agents, she prepares and files formal documents with the USPTO and foreign patent offices, and is an integral part of supporting patent professionals at the firm. She communicates with clients and inventors — both domestic and international — to ensure deadlines are met and guidelines are followed to the highest standard.',
      'Since joining Zilka-Kotab in 2016, Alma has developed deep expertise in managing complex, multi-jurisdictional patent portfolios with precision and care. Her background spans the full range of prosecution support — from initial filings and office action responses to PCT applications and international coordination — and she is a certified PCT Boot Camp graduate, equipping her to handle international patent filings with confidence.',
      'Prior to joining the firm, Alma held paralegal positions at Cypress Semiconductor and IBM, building a strong foundation in high-volume patent portfolio management in the semiconductor and technology sectors. She began her career as a legal assistant at IP Strategy Group, where she developed her core skills in intellectual property practice.',
    ],
    focus: [
      'USPTO & Foreign Filings',
      'PCT Applications',
      'Patent Portfolio Management',
      'Client & Inventor Coordination',
    ],
  },
  {
    slug: 'dominic-kotab',
    name: 'Dominic M. Kotab',
    role: 'Principal',
    category: 'principal',
    photo: '/images/team/kotab.jpg',
    email: 'dominic@zilkakotab.com',
    linkedin: 'https://www.linkedin.com/in/kotab',
    shortBio: 'Dominic is a registered patent attorney and co-founder of Zilka-Kotab PC specializing in high-value patent portfolio strategy across semiconductor, materials, and computer-based technologies.',
    education: [
      'JD, University of San Diego School of Law',
      'BS, Chemical Engineering, South Dakota School of Mines and Technology',
    ],
    admissions: [
      'USPTO',
      'State Bar of California',
      'State Bar of South Dakota',
      'U.S. District Court, N.D. California',
      'U.S. Court of Appeals, Ninth Circuit',
    ],
    memberships: [
      'American Intellectual Property Law Association (AIPLA)',
    ],
    fullBio: [
      'Dominic Kotab is a registered patent attorney and co-founder of Zilka-Kotab PC. With a background in chemical engineering and a strong basis in computer-based technology, he helps companies identify and protect their core inventions and turn them into strategic business assets.',
      'He specializes in building high-value patent portfolios that give clients a competitive edge, strengthen defensibility, support capital raises, and create pathways for long-term monetization. His work spans semiconductor design, fabrication and tooling, data storage and integrated circuits, networks, image processing, mechanical systems, chemical discovery and processing, additive manufacturing, alternative energy technologies such as battery systems and carbon capture, and nanotechnology — with particular strength in AI hardware, advanced materials, and sustainable technologies.',
      'Beyond preparation and prosecution, Dominic has provided strategic counsel through hundreds of validity and freedom-to-operate opinions, infringement analyses, licensing initiatives, and pre-litigation diligence, consistently delivering high-quality work within clients\' budgets. He brings particular expertise in global portfolio management, collaborating with foreign associates chosen over decades to secure effective worldwide protection. He is fluent in Spanish.',
    ],
    focus: [
      'Patent Preparation & Prosecution',
      'Chemical & Mechanical Technologies',
      'Computer-Based Technologies',
      'Portfolio Development',
    ],
  },
  {
    slug: 'jamie-rossi',
    name: 'Jamie Rossi',
    role: 'Principal',
    category: 'principal',
    photo: '/images/team/rossi.jpg',
    email: 'jamie@zilkakotab.com',
    linkedin: 'https://www.linkedin.com/in/jamie-rossi-78783b5',
    shortBio: 'Jamie is a registered patent attorney who joined Zilka-Kotab in 2004, specializing in AI, robotics, semiconductors, and complex software patent portfolios for Fortune 500 corporations and startups.',
    education: [
      'JD, Santa Clara University School of Law',
      'BS, Computer Science, Whitworth College',
    ],
    admissions: [
      'USPTO',
      'State Bar of California',
    ],
    fullBio: [
      'Jamie Rossi is a registered patent attorney who joined Zilka-Kotab PC in 2004. She manages sophisticated patent portfolios for a diverse range of clients, including Fortune 500 corporations, innovative startups, and solo inventors.',
      'With extensive expertise in computer software and hardware, she specializes in the preparation, prosecution, and strategic management of patents in artificial intelligence, robotics, autonomous agent systems, memory systems, semiconductors, database systems, and telecommunication networks. She also collaborates with international associates to prosecute and maintain global patent families, ensuring robust worldwide protection for her clients\' inventions.',
      'Jamie provides in-depth strategic analysis of pending and issued patents for both offensive and defensive purposes, including infringement analyses, validity analyses, and claim charting to identify licensing opportunities. She gives educational presentations on current USPTO policy and best practices for obtaining enforceable, valuable patents, and holds patent-harvesting sessions with inventor groups. By aligning technical depth with business objectives, she delivers patents that build lasting business value and a stronger market position.',
    ],
    focus: [
      'Patent Prosecution',
      'Portfolio Management',
      'Software & Hardware Technologies',
      'Inventor Counseling',
    ],
  },
  {
    slug: 'sally-billstrom-schroeder',
    name: 'Sally Billstrom Schroeder',
    role: 'Patent Agent',
    category: 'member',
    photo: '/images/team/schroeder.jpg',
    email: 'sally@zilkakotab.com',
    linkedin: 'https://www.linkedin.com/in/sallybschroeder/',
    shortBio: 'Sally is a registered patent agent with deep expertise in viral pathogenesis, molecular biology, immunology, and chemistry, helping life sciences clients build strong, enforceable patent portfolios.',
    education: [
      'PhD, Medical Microbiology, University of Birmingham, England',
      'MS, Medical Microbiology, University of Birmingham, England',
      'BA, Chemistry, Carleton College',
    ],
    admissions: [
      'USPTO',
    ],
    memberships: [
      'National Association of Patent Practitioners',
    ],
    fullBio: [
      'Sally Billstrom Schroeder is a registered patent agent with extensive technical expertise in viral pathogenesis, molecular biology, immunology, and chemistry. She helps clients protect complex biological inventions and build strong, enforceable patent portfolios in the life sciences.',
      'Prior to joining Zilka-Kotab PC, Sally led a research team investigating immune-response interactions of virally-encoded chemokine receptors as joint faculty at the University of Colorado Health Science Center and National Jewish Medical and Research Center in Denver. She brings firsthand scientific experience to her patent work, drafting clear, strategically sound applications that support her clients\' objectives in biotechnology and related fields.',
      'She manages both domestic and foreign patent portfolios for private companies and organizations involved in government-funded research, and has authored several peer-reviewed publications in her areas of expertise.',
    ],
    focus: [
      'Biotechnology & Life Sciences',
      'Molecular Biology',
      'Patent Preparation',
      'Patent Prosecution',
    ],
  },
  {
    slug: 'britten-sessions',
    name: 'Britten Sessions',
    role: 'Managing Partner',
    category: 'principal',
    photo: '/images/team/sessions.jpg',
    email: 'britten@zilkakotab.com',
    linkedin: 'https://www.linkedin.com/in/brittensessions',
    shortBio: 'Britten is a registered patent attorney with extensive experience across the full patent lifecycle, closing hundreds of patent transactions and helping generate over $130 million in returns from patent assets.',
    education: [
      'JD, Santa Clara University',
      'BS, Chemical Engineering, Brigham Young University',
    ],
    admissions: [
      'USPTO',
      'State Bar of California',
    ],
    awards: [
      'IAM Strategy 300 (2016–2025)',
      'Super Lawyer (2016–2023)',
      'Silicon Valley Business Journal Top 40 Under 40 (2016)',
    ],
    memberships: [
      'National Association of Patent Practitioners',
    ],
    fullBio: [
      'Britten Sessions is a registered patent attorney with extensive experience across the full patent lifecycle — from identifying promising inventions early in the disclosure phase and building strong portfolios to licensing, enforcement, and monetization of IP assets. He has guided clients ranging from individual inventors and startups to Fortune 500 companies, closing hundreds of patent-related transactions and helping generate over $130 million in returns from patent assets.',
      'He serves as Executive-in-Residence and Adjunct Faculty at Gonzaga University School of Law, where he founded and supervises the Intellectual Property Law Clinic. He previously founded the IP Clinic at Lincoln Law School of San Jose, where he was Associate Dean of Intellectual Property and developed certificate, MLS, and LLM IP-focused programs. He has authored over ten IP-related books, including the IP Practice Training Resource (volumes 1 and 2), used at multiple universities to train the next generation of patent and IP students.',
      'He prosecutes patents across AI, robotics, advanced materials, energy storage, semiconductors, and software, specializing in helping early-stage innovators build portfolios that support fundraising, strengthen competitive positioning, and create long-term business value.',
    ],
    focus: [
      'Full Patent Lifecycle',
      'Patent Licensing',
      'Litigation Support',
      'Strategic Portfolio Building',
    ],
  },
  {
    slug: 'kevin-zilka',
    name: 'Kevin J. Zilka',
    role: 'Principal',
    category: 'principal',
    photo: '/images/team/zilka.jpg',
    email: 'kevin@zilkakotab.com',
    linkedin: 'https://www.linkedin.com/in/kevinzilka',
    shortBio: 'Kevin is a registered patent attorney and co-founder of Zilka-Kotab PC with more than 30 years of experience, repeatedly named to the IAM Strategy 300 as one of the world\'s leading IP strategists.',
    education: [
      'JD, Santa Clara University',
      'MSEE, University of South Florida',
      'BSEE, University of South Florida',
    ],
    admissions: [
      'USPTO',
      'State Bar of California',
      'U.S. District Court, N.D. California',
      'U.S. Court of Appeals, Ninth Circuit',
    ],
    awards: [
      'IAM Strategy 300',
    ],
    fullBio: [
      'Kevin Zilka is a registered patent attorney and co-founder of Zilka-Kotab PC with more than 30 years of experience in intellectual property law. He has been repeatedly named to the IAM Strategy 300, Intellectual Asset Management magazine\'s annual list of the world\'s 300 leading IP strategists. He built and leads the firm\'s team of patent practitioners and has helped clients turn strategically built portfolios into significant revenue through high-stakes licensing negotiations.',
      'He specializes in strategic patent portfolio development and management, focusing on aggressive yet thoughtful procurement that delivers both offensive and defensive positioning aligned with real business objectives. He pioneered best practices for integrating competitive intelligence into the patent process and developed a patented software tool to improve strategic claim positioning during prosecution — work that has contributed to high-value licensing outcomes worth hundreds of millions of dollars.',
      'With a master\'s in electrical and electronics engineering, Kevin works across foundational and frontier technologies, including software and business methods, graphics processing and computer vision, analog and digital circuits, semiconductor architectures, network systems, encryption, compression, memory technologies, speech recognition, and wireless. He helps clients in AI, robotics, autonomous systems, and secure computing build portfolios that strengthen competitive positioning, support fundraising, and create long-term business value. He frequently speaks at patent, technology, and legal conferences and has authored influential articles on patent strategy.',
    ],
    focus: [
      'Patent Portfolio Strategy',
      'Software & AI Technologies',
      'Semiconductor & Networking',
      'IP Monetization',
    ],
  },
];

export function getMemberBySlug(slug: string): TeamMember | undefined {
  return team.find((m) => m.slug === slug);
}
