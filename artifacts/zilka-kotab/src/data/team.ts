export interface TeamMember {
  slug: string;
  name: string;
  role: string;
  category: 'principal' | 'member';
  photo: string;
  email: string;
  linkedin?: string;
  shortBio: string;
  fullBio: string[];
  focus: string[];
}

export const team: TeamMember[] = [
  {
    slug: 'kevin-zilka',
    name: 'Kevin J. Zilka',
    role: 'Principal',
    category: 'principal',
    photo: '/images/team/zilka.jpg',
    email: 'kevin@zilkakotab.com',
    linkedin: 'https://www.linkedin.com/in/kevinzilka',
    shortBio:
      'Kevin has over 25 years of experience in the intellectual property field and has been repeatedly selected as one of the world\'s leading 300 IP strategists by IAM Strategy 300.',
    fullBio: [
      'Kevin Zilka has over 25 years of experience in the intellectual property (IP) field and, as a result of his accomplishments in patent law, has been repeatedly selected as one of the world\'s leading 300 IP strategists.',
      'Kevin\'s practice focuses on developing comprehensive patent strategies for high technology companies, with particular depth in software, semiconductors, networking, and artificial intelligence technologies. He works closely with clients to build patent portfolios that are aligned with their business objectives and positioned for maximum commercial value.',
      'Kevin is a registered patent attorney before the United States Patent and Trademark Office (USPTO) and is admitted to practice law in the State of California.',
    ],
    focus: [
      'Patent Portfolio Strategy',
      'Software & AI Technologies',
      'Semiconductor & Networking',
      'IP Monetization',
    ],
  },
  {
    slug: 'dominic-kotab',
    name: 'Dominic M. Kotab',
    role: 'Principal & President',
    category: 'principal',
    photo: '/images/team/kotab.jpg',
    email: 'dominic@zilkakotab.com',
    linkedin: 'https://www.linkedin.com/in/kotab',
    shortBio:
      'Dominic is a registered patent attorney and co-founder of Zilka-Kotab PC, where he currently serves as President. He brings a background in chemical engineering and broad expertise in computer-based technologies.',
    fullBio: [
      'Dominic M. Kotab is a registered patent attorney and co-founder of Zilka-Kotab PC, where he currently serves as President.',
      'With a background in chemical engineering and a strong basis in all types of computer-based technologies, Dominic\'s current practice includes the preparation and prosecution of patent applications, strategic portfolio development, and counseling clients on IP matters ranging from freedom-to-operate analyses to licensing strategy.',
      'Dominic represents a broad range of clients — from Fortune 500 corporations to innovative startups — helping them build and protect IP assets that drive real business value.',
      'Dominic is a registered patent attorney before the USPTO and is admitted to practice law in the State of California.',
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
    shortBio:
      'Jamie joined Zilka-Kotab in 2004 and specializes in managing sophisticated patent portfolios for Fortune 500 corporations, innovative startups, and solo inventors.',
    fullBio: [
      'Jamie Rossi is a registered patent attorney who joined Zilka-Kotab in 2004. She manages sophisticated patent portfolios for a diverse range of clients that include Fortune 500 corporations, innovative startups, and solo inventors.',
      'With deep experience in the preparation and prosecution of patent applications across a wide variety of technology areas, Jamie is skilled at developing strategy tailored to each client\'s business landscape and competitive environment.',
      'Jamie\'s client-focused approach and technical fluency have made her a trusted advisor to both long-standing corporate clients and individual inventors navigating the patent process for the first time.',
      'Jamie is a registered patent attorney before the USPTO and is admitted to practice law in the State of California.',
    ],
    focus: [
      'Patent Prosecution',
      'Portfolio Management',
      'Software & Hardware Technologies',
      'Inventor Counseling',
    ],
  },
  {
    slug: 'britten-sessions',
    name: 'Britten Sessions',
    role: 'Principal',
    category: 'principal',
    photo: '/images/team/sessions.jpg',
    email: 'britten@zilkakotab.com',
    linkedin: 'https://www.linkedin.com/in/brittensessions',
    shortBio:
      'Britten is a registered patent attorney with extensive experience across the full patent lifecycle — from early-stage invention disclosure through portfolio building, licensing, and litigation support.',
    fullBio: [
      'Britten Sessions is a registered patent attorney with extensive experience across the full patent lifecycle. From identifying promising inventions early in the disclosure phase and building strong patent portfolios to licensing and litigation support, Britten provides comprehensive IP counsel at every stage.',
      'Britten works with clients across a broad spectrum of technology areas, advising on strategy, claim development, and positioning patents for both defensive protection and offensive value.',
      'Known for a meticulous and strategic approach, Britten helps clients navigate the complexities of patent law with clarity and confidence — from first disclosure through ultimate monetization.',
      'Britten is a registered patent attorney before the USPTO and is admitted to practice law in the State of California.',
    ],
    focus: [
      'Full Patent Lifecycle',
      'Patent Licensing',
      'Litigation Support',
      'Strategic Portfolio Building',
    ],
  },
  {
    slug: 'sally-billstrom-schroeder',
    name: 'Sally Billstrom Schroeder',
    role: 'Patent Agent',
    category: 'member',
    photo: '/images/team/schroeder.jpg',
    email: 'sally@zilkakotab.com',
    shortBio:
      'Sally is a registered patent agent who supports the firm\'s prosecution practice, working alongside the principals to prepare and prosecute patent applications across a range of technology areas.',
    fullBio: [
      'Sally Billstrom Schroeder is a registered patent agent with Zilka-Kotab PC, where she works alongside the firm\'s principals in the preparation and prosecution of patent applications.',
      'Sally brings technical depth and meticulous attention to detail to each matter, ensuring that applications are drafted to maximize coverage and withstand examination.',
    ],
    focus: [
      'Patent Preparation',
      'Patent Prosecution',
      'Technical Analysis',
    ],
  },
];

export function getMemberBySlug(slug: string): TeamMember | undefined {
  return team.find((m) => m.slug === slug);
}
