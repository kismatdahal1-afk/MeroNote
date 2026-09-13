import type {
  Bookmark,
  DownloadItem,
  MockUser,
  ProgramInfo,
  RecentEntry,
  ReadingProgress,
  ResourceType,
  Subject,
  Topic,
} from "../types";

/**
 * Phase 2 mock/seed data.
 * Semesters/Subjects/Topics/Resources are SEED shapes only — the CMS store
 * (state/cmsStore) upgrades them into full records with status/timestamps.
 * Structure mirrors the future API shape so it can be replaced by real API
 * data without changing consuming components.
 */

/** Seed semester (pre-CMS upgrade). */
export interface SeedSemester {
  id: string;
  number: number;
  name: string;
  description: string;
  subjectCount: number;
  resourceCount: number;
  credits: number;
  enrollment: "passed" | "active" | "upcoming";
}

/** Seed subject — a Subject minus the CMS-managed fields. */
export type SeedSubject = Omit<Subject, "status" | "createdAt" | "updatedAt" | "deletedAt">;

/** Seed topic — a Topic minus the CMS-managed fields. */
export type SeedTopic = Omit<Topic, "status" | "createdAt" | "updatedAt" | "deletedAt">;

export type SeedResource = {
  id: string;
  title: string;
  description: string;
  semesterId: string;
  subjectId: string;
  topicId?: string;
  type: ResourceType;
  fileName: string;
  fileSize: number;
  pageCount: number;
  tags: string[];
  uploadedAt: string;
  updatedAt: string;
};

const iso = (daysAgo: number): string =>
  new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

/**
 * Real TU BSc CSIT semester structure (course slots / credit hours).
 * Semesters I–IV: 5 slots, 15 credits each.
 * Semesters V–VI: 6 slots, 18 credits each.
 * Semesters VII: 5 slots, 15 credits. Semester VIII: 4 slots, 15 credits.
 * `resourceCount` reflects seeded mock resources; subject slots are real.
 */
export const semesters: SeedSemester[] = [
  { id: "sem-1", number: 1, name: "Semester 1", description: "Foundations of programming, mathematics, and computing.", subjectCount: 5, resourceCount: 18, credits: 15, enrollment: "passed" },
  { id: "sem-2", number: 2, name: "Semester 2", description: "Digital logic, microprocessor fundamentals, and statistics.", subjectCount: 5, resourceCount: 15, credits: 15, enrollment: "passed" },
  { id: "sem-3", number: 3, name: "Semester 3", description: "Data structures, numerical methods, and theory of computation.", subjectCount: 5, resourceCount: 21, credits: 15, enrollment: "passed" },
  { id: "sem-4", number: 4, name: "Semester 4", description: "Algorithms, databases, operating systems fundamentals.", subjectCount: 5, resourceCount: 19, credits: 15, enrollment: "active" },
  { id: "sem-5", number: 5, name: "Semester 5", description: "Computer networks, simulation, and modelling.", subjectCount: 6, resourceCount: 16, credits: 18, enrollment: "upcoming" },
  { id: "sem-6", number: 6, name: "Semester 6", description: "Software engineering, AI foundations, and graphics.", subjectCount: 6, resourceCount: 20, credits: 18, enrollment: "upcoming" },
  { id: "sem-7", number: 7, name: "Semester 7", description: "Advanced electives: IoT, security, and distributed systems.", subjectCount: 5, resourceCount: 14, credits: 15, enrollment: "upcoming" },
  { id: "sem-8", number: 8, name: "Semester 8", description: "Final semester: project work and advanced electives.", subjectCount: 4, resourceCount: 10, credits: 15, enrollment: "upcoming" },
];

export const subjects: SeedSubject[] = [  // Semester 1
  { id: "sub-csa", semesterId: "sem-1", name: "Computer System Architecture", code: "CSC101", description: "Number systems, logic gates, and basic computer organization.", category: "core", credits: 3, offlineSync: 1, hotTopics: ["Booth algorithm", "K-maps", "Addressing modes"], fullMarks: 60 },
  { id: "sub-cprog", semesterId: "sem-1", name: "C Programming", code: "CSC102", description: "Procedural programming fundamentals with the C language.", category: "core", credits: 3, offlineSync: 1, hotTopics: ["Pointers", "File handling", "Structures"], fullMarks: 60 },
  { id: "sub-math1", semesterId: "sem-1", name: "Mathematics I", code: "MTH103", description: "Calculus, algebra, and analytical geometry.", category: "core", credits: 3, offlineSync: 0.8, hotTopics: ["Taylor series", "L'Hopital", "Matrices"], fullMarks: 60 },
  { id: "sub-phy", semesterId: "sem-1", name: "Physics", code: "PHY104", description: "Mechanics, waves, and modern physics basics.", category: "core", credits: 3, offlineSync: 1, hotTopics: ["Interference", "Photoelectric effect"], fullMarks: 60 },
  { id: "sub-soc1", semesterId: "sem-1", name: "Society & Technology", code: "SOC105", description: "Technology, ethics, and their interplay with society.", category: "core", credits: 3, offlineSync: 0, hotTopics: ["Tech ethics", "Digital divide"], fullMarks: 60 },
  // Semester 2
  { id: "sub-dlogic", semesterId: "sem-2", name: "Digital Logic", code: "CSC201", description: "Combinational and sequential circuit design.", category: "core", credits: 3, offlineSync: 1, hotTopics: ["K-maps", "Flip-flops", "Counters"], fullMarks: 60 },
  { id: "sub-micro", semesterId: "sem-2", name: "Microprocessor", code: "CSC202", description: "8085/8086 architecture, assembly programming.", category: "core", credits: 3, offlineSync: 0.6, hotTopics: ["8085 interrupts", "Timing diagrams"], fullMarks: 60 },
  { id: "sub-math2", semesterId: "sem-2", name: "Mathematics II", description: "Differential equations and linear algebra.", code: "MTH203", category: "core", credits: 4, offlineSync: 0.4, hotTopics: ["Laplace transforms", "Eigenvalues"], fullMarks: 60 },
  { id: "sub-stat", semesterId: "sem-2", name: "Statistics I", code: "STA204", description: "Descriptive statistics and probability.", category: "core", credits: 3, offlineSync: 1, hotTopics: ["Bayes theorem", "Distributions"], fullMarks: 60 },
  { id: "sub-lib2", semesterId: "sem-2", name: "Library & Information Services", code: "LIB205", description: "Research methods, referencing, and academic writing.", category: "core", credits: 3, offlineSync: 0, hotTopics: ["Citation styles", "Research process"], fullMarks: 60 },
  // Semester 3
  { id: "sub-dsa", semesterId: "sem-3", name: "Data Structures & Algorithms", code: "CSC301", description: "Lists, trees, graphs, and core algorithms.", category: "core", credits: 4, offlineSync: 1, hotTopics: ["AVL rotations", "Graph traversals", "Hashing"], fullMarks: 60 },
  { id: "sub-oorad", semesterId: "sem-3", name: "OOP with C++", code: "CSC302", description: "Object-oriented design and C++ implementation.", category: "core", credits: 3, offlineSync: 0.9, hotTopics: ["Virtual functions", "Operator overloading", "STL"], fullMarks: 60 },
  { id: "sub-num", semesterId: "sem-3", name: "Numerical Methods", code: "CSC303", description: "Numerical computation and approximation techniques.", category: "core", credits: 3, offlineSync: 0.5, hotTopics: ["Newton-Raphson", "Lagrange interpolation"], fullMarks: 60 },
  { id: "sub-toc", semesterId: "sem-3", name: "Theory of Computation", code: "CSC304", description: "Automata, formal languages, and computability.", category: "core", credits: 3, offlineSync: 0.7, hotTopics: ["Turing machines", "Pumping lemma", "DFA/NFA"], fullMarks: 60 },
  { id: "sub-ai", semesterId: "sem-3", name: "AI Foundations", code: "CSC305", description: "Search, knowledge representation, and reasoning.", category: "elective", credits: 3, offlineSync: 0.3, hotTopics: ["A* search", "Knowledge representation"], fullMarks: 60 },
  // Semester 4
  { id: "sub-algo", semesterId: "sem-4", name: "Design & Analysis of Algorithms", code: "CSC401", description: "Algorithm design paradigms and complexity.", category: "core", credits: 4, offlineSync: 0.64, hotTopics: ["Master theorem", "Dijkstra", "NP-completeness"], fullMarks: 60 },
  { id: "sub-dbms", semesterId: "sem-4", name: "Database Management System", code: "CSC402", description: "Relational model, SQL, normalization, transactions.", category: "core", credits: 4, offlineSync: 0.64, hotTopics: ["Normalization", "Joins", "Transactions"], fullMarks: 60 },
  { id: "sub-os", semesterId: "sem-4", name: "Operating Systems", code: "CSC403", description: "Processes, scheduling, memory, and file systems.", category: "core", credits: 4, offlineSync: 0.64, hotTopics: ["Deadlocks", "Page replacement", "CPU scheduling"], fullMarks: 60 },
  { id: "sub-coa", semesterId: "sem-4", name: "Computer Organization", code: "CSC404", description: "Instruction sets, pipelining, and memory hierarchy.", category: "core", credits: 3, offlineSync: 0.2, hotTopics: ["Pipelining", "Cache mapping"], fullMarks: 60 },
  { id: "sub-stat2", semesterId: "sem-4", name: "Statistics II", code: "STA405", description: "Inference, regression, and statistical computing.", category: "core", credits: 3, offlineSync: 0, hotTopics: ["Regression", "Hypothesis testing"], fullMarks: 60 },
  // Semester 5
  { id: "sub-cnet", semesterId: "sem-5", name: "Computer Networks", code: "CSC501", description: "OSI/TCP-IP layers, protocols, and network programming.", category: "core", credits: 4, offlineSync: 0, hotTopics: ["OSI layers", "TCP congestion", "Subnetting"], fullMarks: 60 },
  { id: "sub-sim", semesterId: "sem-5", name: "Simulation & Modelling", code: "CSC502", description: "Discrete-event simulation and stochastic models.", category: "core", credits: 3, offlineSync: 0, hotTopics: ["Monte Carlo", "Queueing models"], fullMarks: 60 },
  { id: "sub-web", semesterId: "sem-5", name: "Web Technologies", code: "CSC503", description: "HTML, CSS, JavaScript, and modern web development.", category: "elective", credits: 3, offlineSync: 0.1, hotTopics: ["DOM", "Promises", "Flexbox"], fullMarks: 60 },
  { id: "sub-mm", semesterId: "sem-5", name: "Multimedia Computing", code: "CSC504", description: "Audio, image, and video processing fundamentals.", category: "elective", credits: 3, offlineSync: 0, hotTopics: ["JPEG compression", "Color models"], fullMarks: 60 },
  { id: "sub-cyber5", semesterId: "sem-5", name: "Cyber Law & Ethics", code: "LAW505", description: "Legal frameworks, policies, and professional ethics in computing.", category: "core", credits: 3, offlineSync: 0, hotTopics: ["IT Act", "Privacy law"], fullMarks: 60 },
  { id: "sub-tech5", semesterId: "sem-5", name: "Technical Writing", code: "CSC506", description: "Documentation, reports, and professional communication.", category: "core", credits: 3, offlineSync: 0, hotTopics: ["Report structure", "API docs"], fullMarks: 60 },
  // Semester 6
  { id: "sub-se", semesterId: "sem-6", name: "Software Engineering", code: "CSC601", description: "Process models, requirements, design, and testing.", category: "core", credits: 3, offlineSync: 0, hotTopics: ["COCOMO", "Testing levels", "UML"], fullMarks: 60 },
  { id: "sub-ai2", semesterId: "sem-6", name: "Artificial Intelligence", code: "CSC602", description: "Machine learning, planning, and neural networks.", category: "core", credits: 3, offlineSync: 0, hotTopics: ["Minimax", "Bayesian nets", "Neural nets"], fullMarks: 60 },
  { id: "sub-cg", semesterId: "sem-6", name: "Computer Graphics", code: "CSC603", description: "Raster graphics, transformations, and rendering.", category: "core", credits: 3, offlineSync: 0, hotTopics: ["Bresenham", "Clipping", "Transformations"], fullMarks: 60 },
  { id: "sub-bi", semesterId: "sem-6", name: "Business Intelligence", code: "CSC604", description: "Data warehousing, OLAP, and analytics.", category: "elective", credits: 3, offlineSync: 0, hotTopics: ["OLAP", "Star schema"], fullMarks: 60 },
  { id: "sub-ml", semesterId: "sem-6", name: "Machine Learning", code: "CSC605", description: "Supervised and unsupervised learning techniques.", category: "elective", credits: 3, offlineSync: 0, hotTopics: ["SVM", "Overfitting", "Gradient descent"], fullMarks: 60 },
  { id: "sub-ml2", semesterId: "sem-6", name: "Deep Learning", code: "CSC606", description: "Neural architectures, training, and modern practice.", category: "elective", credits: 3, offlineSync: 0, hotTopics: ["Backpropagation", "CNNs", "Attention"], fullMarks: 60 },
  // Semester 7
  { id: "sub-distributed", semesterId: "sem-7", name: "Distributed Systems", code: "CSC701", description: "Distribution, consensus, and cloud fundamentals.", category: "core", credits: 3, offlineSync: 0, hotTopics: ["CAP theorem", "Raft", "Vector clocks"], fullMarks: 60 },
  { id: "sub-sec", semesterId: "sem-7", name: "Information Security", code: "CSC702", description: "Cryptography, security protocols, and ethics.", category: "core", credits: 3, offlineSync: 0, hotTopics: ["AES", "RSA", "Digital signatures"], fullMarks: 60 },
  { id: "sub-iot", semesterId: "sem-7", name: "IoT & Embedded Systems", code: "CSC703", description: "Sensors, actuators, and connected devices.", category: "elective", credits: 3, offlineSync: 0, hotTopics: ["MQTT", "Edge computing"], fullMarks: 60 },
  { id: "sub-cloud", semesterId: "sem-7", name: "Cloud Computing", code: "CSC704", description: "Virtualization, services, and deployment models.", category: "elective", credits: 3, offlineSync: 0, hotTopics: ["IaaS/PaaS", "Virtualization"], fullMarks: 60 },
  { id: "sub-adv7", semesterId: "sem-7", name: "Advanced Elective", code: "CSC705", description: "Advanced specialization elective chosen with the department.", category: "elective", credits: 3, offlineSync: 0, hotTopics: ["Seminar", "Case study"], fullMarks: 60 },
  // Semester 8
  { id: "sub-project", semesterId: "sem-8", name: "Project Work", code: "CSC801", description: "Final-year capstone project development.", category: "core", credits: 6, offlineSync: 0, hotTopics: ["Report format", "Viva prep"], fullMarks: 100 },
  { id: "sub-nlp", semesterId: "sem-8", name: "Natural Language Processing", code: "CSC802", description: "Text processing, embeddings, and language models.", category: "elective", credits: 3, offlineSync: 0, hotTopics: ["Tokenization", "Embeddings"], fullMarks: 60 },
  { id: "sub-blockchain", semesterId: "sem-8", name: "Blockchain Technology", code: "CSC803", description: "Distributed ledgers, consensus, and smart contracts.", category: "elective", credits: 3, offlineSync: 0, hotTopics: ["Consensus", "Smart contracts"], fullMarks: 60 },
  { id: "sub-adv8", semesterId: "sem-8", name: "Advanced Elective", code: "CSC804", description: "Advanced specialization elective chosen with the department.", category: "elective", credits: 3, offlineSync: 0, hotTopics: ["Proposal writing", "Literature review"], fullMarks: 60 },
];

/**
 * Admin-managed syllabus topics per subject. Topics own their resources
 * through Resource.topicId — the Subject → Topic → Resource hierarchy.
 */
export const topics: SeedTopic[] = [
  // Computer System Architecture (Sem 1)
  { id: "top-csa-1", subjectId: "sub-csa", title: "Number Systems", description: "Binary, octal, decimal and hexadecimal representations, conversions and arithmetic.", order: 1, published: true },
  { id: "top-csa-2", subjectId: "sub-csa", title: "Logic Gates", description: "Basic and universal gates, truth tables and gate-level design.", order: 2, published: true },
  { id: "top-csa-3", subjectId: "sub-csa", title: "Boolean Algebra", description: "Laws, simplification and canonical forms.", order: 3, published: true },
  { id: "top-csa-4", subjectId: "sub-csa", title: "K-Maps", description: "Karnaugh map minimization up to four variables.", order: 4, published: true },
  { id: "top-csa-5", subjectId: "sub-csa", title: "Computer Organization", description: "CPU components, registers, buses and instruction cycles.", order: 5, published: true },
  { id: "top-csa-6", subjectId: "sub-csa", title: "Memory Organization", description: "Memory hierarchy, cache and virtual memory basics.", order: 6, published: true },
  // C Programming (Sem 1)
  { id: "top-cprog-1", subjectId: "sub-cprog", title: "Fundamentals & Control Flow", description: "Structure of a C program, operators, loops and branching.", order: 1, published: true },
  { id: "top-cprog-2", subjectId: "sub-cprog", title: "Arrays & Strings", order: 2, published: true },
  { id: "top-cprog-3", subjectId: "sub-cprog", title: "Pointers & Memory", description: "Pointer arithmetic, dynamic memory and addressing.", order: 3, published: true },
  { id: "top-cprog-4", subjectId: "sub-cprog", title: "Structures & File Handling", order: 4, published: true },
  // Data Structures & Algorithms (Sem 3)
  { id: "top-dsa-1", subjectId: "sub-dsa", title: "Arrays & Linked Lists", order: 1, published: true },
  { id: "top-dsa-2", subjectId: "sub-dsa", title: "Stacks & Queues", order: 2, published: true },
  { id: "top-dsa-3", subjectId: "sub-dsa", title: "Trees & BST", description: "Binary trees, traversals and balanced trees.", order: 3, published: true },
  { id: "top-dsa-4", subjectId: "sub-dsa", title: "Graphs", description: "Representations, BFS/DFS and shortest paths.", order: 4, published: true },
  { id: "top-dsa-5", subjectId: "sub-dsa", title: "Sorting & Searching", order: 5, published: true },
  { id: "top-dsa-6", subjectId: "sub-dsa", title: "Hashing", description: "Hash tables, collision resolution strategies.", order: 6, published: true },
  // Database Management System (Sem 4)
  { id: "top-dbms-1", subjectId: "sub-dbms", title: "ER Model & Relational Algebra", order: 1, published: true },
  { id: "top-dbms-2", subjectId: "sub-dbms", title: "SQL", description: "DDL, DML and query formulation.", order: 2, published: true },
  { id: "top-dbms-3", subjectId: "sub-dbms", title: "Normalization", order: 3, published: true },
  { id: "top-dbms-4", subjectId: "sub-dbms", title: "Transactions & Concurrency", order: 4, published: true },
];

interface ResourceSeed {
  id: string;
  title: string;
  description: string;
  subjectId: string;
  /** Optional topic link — resources may belong to a syllabus topic. */
  topicId?: string;
  type: ResourceType;
  fileSizeMB: number;
  pageCount: number;
  tags: string[];
  uploadedDaysAgo: number;
}

const resourceSeeds: ResourceSeed[] = [
  // CSA — primary textbook covers the whole subject (no topicId).
  { id: "res-csa-book", title: "Computer System Architecture — Complete Textbook", description: "Comprehensive textbook covering number systems, boolean algebra, logic gates, and CPU organization with solved examples.", subjectId: "sub-csa", type: "book", fileSizeMB: 48.2, pageCount: 890, tags: ["textbook", "morris-mano", "cpu"], uploadedDaysAgo: 220 },
  { id: "res-csa-notes", title: "CSA Short Notes — All Units", description: "Condensed unit-wise notes for last-minute revision.", subjectId: "sub-csa", topicId: "top-csa-1", type: "short_note", fileSizeMB: 2.1, pageCount: 64, tags: ["notes", "revision"], uploadedDaysAgo: 95 },
  { id: "res-csa-num-hw", title: "Number Systems — Handwritten Note", description: "Handwritten class note with conversion shortcuts and worked examples.", subjectId: "sub-csa", topicId: "top-csa-1", type: "handwritten_note", fileSizeMB: 1.2, pageCount: 8, tags: ["handwritten", "number-systems"], uploadedDaysAgo: 88 },
  { id: "res-csa-num-paper", title: "Number Systems — Past Questions", description: "Repeated TU board questions on number systems with solutions.", subjectId: "sub-csa", topicId: "top-csa-1", type: "past_paper", fileSizeMB: 0.9, pageCount: 12, tags: ["past-papers", "exam"], uploadedDaysAgo: 40 },
  { id: "res-csa-gates-note", title: "Logic Gates — Short Note", description: "Gate symbols, truth tables and universal gate design patterns.", subjectId: "sub-csa", topicId: "top-csa-2", type: "short_note", fileSizeMB: 0.8, pageCount: 9, tags: ["notes", "gates"], uploadedDaysAgo: 74 },
  { id: "res-csa-kmap-rev", title: "K-Maps — Revision Note", description: "Pair/quads grouping rules with solved minimization examples.", subjectId: "sub-csa", topicId: "top-csa-4", type: "revision_note", fileSizeMB: 0.6, pageCount: 5, tags: ["revision", "k-map"], uploadedDaysAgo: 18 },
  { id: "res-csa-paper", title: "CSA Past Papers — 2018-2024 Collection", description: "Seven years of solved and unsolved question papers with marking scheme hints.", subjectId: "sub-csa", topicId: "top-csa-5", type: "past_paper", fileSizeMB: 12.8, pageCount: 210, tags: ["past-papers", "exam"], uploadedDaysAgo: 42 },
  // C Programming
  { id: "res-cprog-book", title: "Let Us C â€” Reference Book", description: "Classic C programming reference covering pointers, arrays, file handling, and structures.", subjectId: "sub-cprog", type: "book", fileSizeMB: 31.5, pageCount: 640, tags: ["textbook", "c", "beginner"], uploadedDaysAgo: 310 },
  { id: "res-cprog-lab", title: "C Programming Lab Manual", description: "Complete lab exercises with solutions: loops, arrays, pointers, and file I/O.", subjectId: "sub-cprog", type: "practical", fileSizeMB: 4.4, pageCount: 120, tags: ["lab", "practical", "solutions"], uploadedDaysAgo: 150 },
  { id: "res-cprog-imp", title: "C Important Questions â€” Board Exam", description: "Frequently repeated board exam questions with answer guidelines.", subjectId: "sub-cprog", type: "important_questions", fileSizeMB: 1.2, pageCount: 38, tags: ["important", "exam"], uploadedDaysAgo: 60 },
  { id: "res-cprog-extra", title: "C Extra Notes â€” Pointers Deep Dive", description: "Extra explanatory material dedicated entirely to pointer arithmetic and memory management.", subjectId: "sub-cprog", type: "extra_note", fileSizeMB: 3.3, pageCount: 92, tags: ["pointers", "memory"], uploadedDaysAgo: 80 },
  // Math I
  { id: "res-math1-book", title: "Engineering Mathematics â€” Volume I", description: "Calculus and algebra textbook with extensive exercise sets.", subjectId: "sub-math1", type: "book", fileSizeMB: 55.0, pageCount: 1020, tags: ["textbook", "calculus"], uploadedDaysAgo: 400 },
  { id: "res-math1-qn", title: "Mathematics I â€” Question Bank", description: "Chapter-wise question bank with formula sheet appendix.", subjectId: "sub-math1", type: "questions", fileSizeMB: 2.9, pageCount: 88, tags: ["questions", "formulas"], uploadedDaysAgo: 70 },
  // Physics
  { id: "res-phy-notes", title: "Physics Short Notes â€” Mechanics & Waves", description: "Exam-focused summary notes covering mechanics, oscillations, and wave optics.", subjectId: "sub-phy", type: "short_note", fileSizeMB: 1.8, pageCount: 52, tags: ["notes", "mechanics"], uploadedDaysAgo: 130 },
  { id: "res-phy-paper", title: "Physics Past Papers â€” 2019-2024", description: "Recent six years of physics question papers.", subjectId: "sub-phy", type: "past_paper", fileSizeMB: 8.7, pageCount: 165, tags: ["past-papers"], uploadedDaysAgo: 33 },
  // Digital Logic
  { id: "res-dlogic-book", title: "Digital Fundamentals â€” Textbook", description: "Number systems, combinational logic, flip-flops, and sequential circuit design.", subjectId: "sub-dlogic", type: "book", fileSizeMB: 42.6, pageCount: 780, tags: ["textbook", "floyd"], uploadedDaysAgo: 260 },
  { id: "res-dlogic-lab", title: "Digital Logic Lab â€” Experiment Sheets", description: "All lab experiments with circuit diagrams and observation tables.", subjectId: "sub-dlogic", type: "practical", fileSizeMB: 3.1, pageCount: 75, tags: ["lab", "circuits"], uploadedDaysAgo: 110 },
  { id: "res-dlogic-rev", title: "Digital Logic Revision Note", description: "One-shot revision note covering K-maps, counters, and registers.", subjectId: "sub-dlogic", type: "revision_note", fileSizeMB: 0.9, pageCount: 28, tags: ["revision", "k-map"], uploadedDaysAgo: 20 },
  // Microprocessor
  { id: "res-micro-notes", title: "8085 Microprocessor â€” Unit Wise Notes", description: "Architecture, instruction set, interrupts, and interfacing notes.", subjectId: "sub-micro", type: "short_note", fileSizeMB: 2.6, pageCount: 85, tags: ["8085", "notes"], uploadedDaysAgo: 90 },
  { id: "res-micro-imp", title: "Microprocessor Important Questions", description: "Top repeated questions: programs, timing diagrams, and interfacing.", subjectId: "sub-micro", type: "important_questions", fileSizeMB: 1.4, pageCount: 40, tags: ["important"], uploadedDaysAgo: 25 },
  // Statistics
  { id: "res-stat-notes", title: "Statistics I â€” Formula Sheet & Notes", description: "All key formulas with brief explanations and example calculations.", subjectId: "sub-stat", type: "short_note", fileSizeMB: 1.1, pageCount: 34, tags: ["formulas", "statistics"], uploadedDaysAgo: 55 },
  // DSA
  { id: "res-dsa-book", title: "Introduction to Algorithms â€” CLRS", description: "The definitive algorithms textbook covering proofs, paradigms, and complexity analysis.", subjectId: "sub-dsa", type: "book", fileSizeMB: 68.4, pageCount: 1310, tags: ["textbook", "clrs", "algorithms"], uploadedDaysAgo: 350 },
  { id: "res-dsa-notes", title: "DSA Short Notes â€” Arrays to Graphs", description: "Concise notes with diagrams for every core data structure and algorithm.", subjectId: "sub-dsa", type: "short_note", fileSizeMB: 4.8, pageCount: 140, tags: ["notes", "graphs", "trees"], uploadedDaysAgo: 65 },
  { id: "res-dsa-qn", title: "DSA Question Set â€” Interview + Board", description: "Mixed question set for board exams and interview practice.", subjectId: "sub-dsa", type: "questions", fileSizeMB: 3.6, pageCount: 110, tags: ["questions", "interview"], uploadedDaysAgo: 48 },
  { id: "res-dsa-extra", title: "DSA Extra Notes â€” Complexity Cheatsheet", description: "Big-O reference tables for sorting, searching, and graph algorithms.", subjectId: "sub-dsa", type: "extra_note", fileSizeMB: 0.7, pageCount: 22, tags: ["big-o", "cheatsheet"], uploadedDaysAgo: 15 },
  { id: "res-dsa-rev", title: "DSA Revision Note â€” Night Before Exam", description: "Ultra-condensed revision note for rapid final review.", subjectId: "sub-dsa", type: "revision_note", fileSizeMB: 0.5, pageCount: 18, tags: ["revision"], uploadedDaysAgo: 8 },
  // OOP
  { id: "res-oorad-book", title: "Object Oriented Programming with C++", description: "Classes, inheritance, polymorphism, templates, and STL explained with examples.", subjectId: "sub-oorad", type: "book", fileSizeMB: 39.9, pageCount: 720, tags: ["textbook", "cpp", "oop"], uploadedDaysAgo: 280 },
  { id: "res-oorad-lab", title: "OOP Lab Manual â€” C++ Programs", description: "Complete lab programs with expected outputs and viva questions.", subjectId: "sub-oorad", type: "practical", fileSizeMB: 5.2, pageCount: 132, tags: ["lab", "cpp"], uploadedDaysAgo: 100 },
  // Numerical Methods
  { id: "res-num-notes", title: "Numerical Methods â€” Solved Problem Notes", description: "Root finding, interpolation, and numerical integration with worked solutions.", subjectId: "sub-num", type: "short_note", fileSizeMB: 3.9, pageCount: 96, tags: ["solved", "notes"], uploadedDaysAgo: 72 },
  // Theory of Computation
  { id: "res-toc-book", title: "Introduction to Automata Theory", description: "Formal languages, automata, Turing machines, and decidability.", subjectId: "sub-toc", type: "book", fileSizeMB: 28.7, pageCount: 540, tags: ["textbook", "automata", "flips"], uploadedDaysAgo: 240 },
  { id: "res-toc-paper", title: "TOC Past Papers â€” 2017-2024", description: "Eight years of theory of computation papers with solutions.", subjectId: "sub-toc", type: "past_paper", fileSizeMB: 9.9, pageCount: 188, tags: ["past-papers", "automata"], uploadedDaysAgo: 36 },
  // AI Foundations
  { id: "res-ai-notes", title: "AI Foundations â€” Search & Knowledge Notes", description: "BFS/DFS search, heuristic search, and knowledge representation summaries.", subjectId: "sub-ai", type: "short_note", fileSizeMB: 2.2, pageCount: 68, tags: ["ai", "search"], uploadedDaysAgo: 58 },
  // Algorithms
  { id: "res-algo-notes", title: "DAA Short Notes â€” Divide & Conquer to NP", description: "Design paradigms, recurrences, and NP-completeness notes.", subjectId: "sub-algo", type: "short_note", fileSizeMB: 3.0, pageCount: 82, tags: ["notes", "np"], uploadedDaysAgo: 50 },
  { id: "res-algo-imp", title: "DAA Important Questions â€” Solved", description: "Repeated exam questions with full derivations and complexity proofs.", subjectId: "sub-algo", type: "important_questions", fileSizeMB: 1.9, pageCount: 55, tags: ["important", "solved"], uploadedDaysAgo: 30 },
  // DBMS
  { id: "res-dbms-book", title: "Database System Concepts â€” Textbook", description: "ER model, relational algebra, SQL, normalization, and transactions.", subjectId: "sub-dbms", type: "book", fileSizeMB: 52.3, pageCount: 960, tags: ["textbook", "sql", "korth"], uploadedDaysAgo: 290 },
  { id: "res-dbms-notes", title: "DBMS Short Notes â€” All 8 Units", description: "Unit-wise condensed notes with SQL syntax reference.", subjectId: "sub-dbms", type: "short_note", fileSizeMB: 2.8, pageCount: 90, tags: ["notes", "sql"], uploadedDaysAgo: 62 },
  { id: "res-dbms-paper", title: "DBMS Past Papers â€” 2018-2024", description: "Seven years of DBMS papers with common query patterns.", subjectId: "sub-dbms", type: "past_paper", fileSizeMB: 7.4, pageCount: 140, tags: ["past-papers", "sql"], uploadedDaysAgo: 28 },
  { id: "res-dbms-qn", title: "DBMS Query Practice â€” 150 Queries", description: "SQL practice set from simple selects to joins and subqueries.", subjectId: "sub-dbms", type: "questions", fileSizeMB: 1.6, pageCount: 60, tags: ["sql", "practice"], uploadedDaysAgo: 12 },
  // OS
  { id: "res-os-book", title: "Operating System Concepts â€” Textbook", description: "Silberschatz: processes, scheduling, synchronization, and file systems.", subjectId: "sub-os", type: "book", fileSizeMB: 61.8, pageCount: 1150, tags: ["textbook", "dinosaur", "os"], uploadedDaysAgo: 300 },
  { id: "res-os-notes", title: "OS Short Notes â€” Processes to Deadlocks", description: "Compact notes for scheduling algorithms, memory management, and deadlocks.", subjectId: "sub-os", type: "short_note", fileSizeMB: 3.4, pageCount: 105, tags: ["notes", "scheduling"], uploadedDaysAgo: 44 },
  { id: "res-os-imp", title: "OS Important Questions with Answers", description: "Frequently asked theory questions with model answers.", subjectId: "sub-os", type: "important_questions", fileSizeMB: 2.0, pageCount: 72, tags: ["important", "answers"], uploadedDaysAgo: 18 },
  // Networks
  { id: "res-cnet-book", title: "Computer Networking â€” Top-Down Approach", description: "Application to link layer with socket programming examples.", subjectId: "sub-cnet", type: "book", fileSizeMB: 58.1, pageCount: 1080, tags: ["textbook", "tcp", "networking"], uploadedDaysAgo: 270 },
  { id: "res-cnet-notes", title: "Networks Short Notes â€” OSI & TCP/IP", description: "Layer-wise notes with protocol comparison tables.", subjectId: "sub-cnet", type: "short_note", fileSizeMB: 2.5, pageCount: 78, tags: ["notes", "osi"], uploadedDaysAgo: 52 },
  { id: "res-cnet-lab", title: "Networks Lab â€” Socket Programming Manual", description: "TCP/UDP socket programs in C with sample runs.", subjectId: "sub-cnet", type: "practical", fileSizeMB: 2.9, pageCount: 68, tags: ["lab", "sockets"], uploadedDaysAgo: 38 },
  // Web Tech
  { id: "res-web-book", title: "Web Technologies â€” Complete Guide", description: "HTML5, CSS3, JavaScript, and modern frameworks overview.", subjectId: "sub-web", type: "book", fileSizeMB: 36.7, pageCount: 690, tags: ["textbook", "html", "javascript"], uploadedDaysAgo: 190 },
  { id: "res-web-extra", title: "JavaScript Extra Notes â€” ES6+", description: "Modern JS features: promises, async/await, modules, and DOM patterns.", subjectId: "sub-web", type: "extra_note", fileSizeMB: 1.7, pageCount: 58, tags: ["javascript", "es6"], uploadedDaysAgo: 22 },
  // Software Engineering
  { id: "res-se-book", title: "Software Engineering â€” Pressman", description: "Process models, requirements engineering, and quality assurance.", subjectId: "sub-se", type: "book", fileSizeMB: 47.4, pageCount: 860, tags: ["textbook", "pressman"], uploadedDaysAgo: 230 },
  { id: "res-se-notes", title: "SE Short Notes â€” SDLC to Testing", description: "Lifecycle models, diagrams, and testing strategies in brief.", subjectId: "sub-se", type: "short_note", fileSizeMB: 2.3, pageCount: 66, tags: ["notes", "sdlc"], uploadedDaysAgo: 40 },
  { id: "res-se-qn", title: "SE Case Study Questions", description: "Scenario-based questions on requirements, design, and estimation.", subjectId: "sub-se", type: "questions", fileSizeMB: 1.3, pageCount: 45, tags: ["case-study"], uploadedDaysAgo: 26 },
  // AI
  { id: "res-ai2-book", title: "Artificial Intelligence â€” A Modern Approach", description: "Russell & Norvig: agents, search, logic, learning, and applications.", subjectId: "sub-ai2", type: "book", fileSizeMB: 66.2, pageCount: 1210, tags: ["textbook", "russell", "ai"], uploadedDaysAgo: 210 },
  { id: "res-ai2-imp", title: "AI Important Questions", description: "Repeated questions on search, logic, and learning with answer outlines.", subjectId: "sub-ai2", type: "important_questions", fileSizeMB: 1.5, pageCount: 48, tags: ["important", "ai"], uploadedDaysAgo: 16 },
  // Graphics
  { id: "res-cg-notes", title: "Computer Graphics Short Notes", description: "Scan conversion, transformations, clipping, and visible surface detection.", subjectId: "sub-cg", type: "short_note", fileSizeMB: 2.7, pageCount: 88, tags: ["notes", "graphics"], uploadedDaysAgo: 47 },
  { id: "res-cg-lab", title: "Graphics Lab â€” OpenGL Programs", description: "OpenGL lab programs with setup instructions and outputs.", subjectId: "sub-cg", type: "practical", fileSizeMB: 4.1, pageCount: 95, tags: ["lab", "opengl"], uploadedDaysAgo: 35 },
  // Security
  { id: "res-sec-notes", title: "Information Security Short Notes", description: "Classical ciphers, DES/AES, RSA, and network security protocols.", subjectId: "sub-sec", type: "short_note", fileSizeMB: 3.2, pageCount: 92, tags: ["notes", "crypto"], uploadedDaysAgo: 29 },
  { id: "res-sec-paper", title: "Security Past Papers â€” 2019-2024", description: "Six years of information security papers.", subjectId: "sub-sec", type: "past_paper", fileSizeMB: 6.6, pageCount: 124, tags: ["past-papers", "crypto"], uploadedDaysAgo: 14 },
  // Distributed
  { id: "res-distributed-book", title: "Distributed Systems â€” Principles", description: "Clocks, consistency, replication, and consensus algorithms.", subjectId: "sub-distributed", type: "book", fileSizeMB: 44.9, pageCount: 820, tags: ["textbook", "consensus"], uploadedDaysAgo: 175 },
  { id: "res-distributed-extra", title: "Distributed Systems Extra Notes â€” CAP & Consensus", description: "Focused material on CAP theorem, Paxos, and Raft with diagrams.", subjectId: "sub-distributed", type: "extra_note", fileSizeMB: 1.9, pageCount: 52, tags: ["cap", "raft"], uploadedDaysAgo: 11 },
  // Project
  { id: "res-project-guide", title: "Final Project â€” Report Template & Guide", description: "Report structure, formatting rules, and evaluation criteria guide.", subjectId: "sub-project", type: "other", fileSizeMB: 0.8, pageCount: 24, tags: ["template", "report"], uploadedDaysAgo: 6 },
  { id: "res-project-qn", title: "Project Viva Questions â€” 200+ Collection", description: "Common viva questions organized by project phase.", subjectId: "sub-project", type: "questions", fileSizeMB: 1.2, pageCount: 40, tags: ["viva", "project"], uploadedDaysAgo: 3 },
  // NLP
  { id: "res-nlp-notes", title: "NLP Short Notes â€” Tokenization to LLMs", description: "Text preprocessing, embeddings, and transformer overview notes.", subjectId: "sub-nlp", type: "short_note", fileSizeMB: 2.4, pageCount: 74, tags: ["nlp", "transformers"], uploadedDaysAgo: 5 },
  // Blockchain
  { id: "res-blockchain-book", title: "Blockchain Basics â€” Study Guide", description: "Hash functions, blocks, consensus, and Ethereum smart contracts.", subjectId: "sub-blockchain", type: "book", fileSizeMB: 25.6, pageCount: 480, tags: ["textbook", "ethereum"], uploadedDaysAgo: 9 },
];

function semesterOfSubject(subjectId: string): string {
  const subject = subjects.find((s) => s.id === subjectId);
  if (!subject) throw new Error(`Unknown subject ${subjectId}`);
  return subject.semesterId;
}

export const resources: SeedResource[] = resourceSeeds.map((seed) => ({
  id: seed.id,
  title: seed.title,
  description: seed.description,
  semesterId: semesterOfSubject(seed.subjectId),
  subjectId: seed.subjectId,
  topicId: seed.topicId,
  type: seed.type,
  fileName: `${seed.id}.pdf`,
  fileSize: Math.round(seed.fileSizeMB * 1024 * 1024),
  pageCount: seed.pageCount,
  tags: seed.tags,
  uploadedAt: iso(seed.uploadedDaysAgo),
  updatedAt: iso(Math.max(0, seed.uploadedDaysAgo - 30)),
}));

/** Seeded reading progress â€” shown on Continue Reading cards. */
export const seedProgress: ReadingProgress[] = [
  { resourceId: "res-dsa-book", lastPage: 412, progress: 0.31, updatedAt: iso(0.2) },
  { resourceId: "res-dbms-notes", lastPage: 34, progress: 0.38, updatedAt: iso(1) },
  { resourceId: "res-csa-notes", lastPage: 51, progress: 0.8, updatedAt: iso(3) },
  { resourceId: "res-os-imp", lastPage: 12, progress: 0.17, updatedAt: iso(6) },
];

export const seedFavorites: string[] = [
  "res-dsa-book",
  "res-dbms-qn",
  "res-ai2-book",
  "res-web-extra",
  "res-nlp-notes",
];

export const seedBookmarks: Bookmark[] = [
  { id: "bm-1", resourceId: "res-dsa-book", page: 412, note: "Red-black tree rotations", createdAt: iso(0.2) },
  { id: "bm-2", resourceId: "res-dbms-notes", page: 22, note: "Normalization examples", createdAt: iso(1) },
  { id: "bm-3", resourceId: "res-csa-notes", page: 51, note: "Booth algorithm", createdAt: iso(3) },
  { id: "bm-4", resourceId: "res-cnet-notes", page: 30, note: "TCP vs UDP table", createdAt: iso(9) },
  { id: "bm-5", resourceId: "res-math1-book", page: 155, note: "L'Hopital solved set", createdAt: iso(14) },
];

export const seedDownloads: DownloadItem[] = [
  { id: "dl-1", resourceId: "res-csa-book", status: "completed", progress: 100, sizeBytes: resources[0].fileSize, downloadedAt: iso(4) },
  { id: "dl-2", resourceId: "res-cprog-book", status: "completed", progress: 100, sizeBytes: 33 * 1024 * 1024, downloadedAt: iso(7) },
  { id: "dl-3", resourceId: "res-dbms-book", status: "completed", progress: 100, sizeBytes: 55 * 1024 * 1024, downloadedAt: iso(12) },
];

export const seedRecent: RecentEntry[] = [
  { resourceId: "res-dsa-book", openedAt: iso(0.2) },
  { resourceId: "res-dbms-notes", openedAt: iso(1) },
  { resourceId: "res-csa-notes", openedAt: iso(2.4) },
  { resourceId: "res-os-imp", openedAt: iso(6) },
  { resourceId: "res-nlp-notes", openedAt: iso(6.3) },
  { resourceId: "res-web-extra", openedAt: iso(8) },
  { resourceId: "res-cg-lab", openedAt: iso(11) },
  { resourceId: "res-sec-paper", openedAt: iso(13) },
];

export const mockUser: MockUser = {
  name: "Aarav Sharma",
  email: "aarav@example.com",
  role: "ADMIN",
};

/** Program info for the dashboard greeting banner. */
export const programInfo: ProgramInfo = {
  university: "Tribhuvan University",
  program: "BSc. CSIT",
  batch: "Batch '83",
  studentLabel: "TU CSIT Student",
  currentSemesterId: "sem-4",
  exam: {
    title: "TU Board Exam",
    scope: "Sem IV",
    date: new Date(Date.now() + 24 * 24 * 60 * 60 * 1000).toISOString(),
  },
};
