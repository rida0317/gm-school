// src/services/chatbot.service.ts - AI Chatbot service for school assistance

export interface ChatMessage {
  id: string
  text: string
  sender: 'user' | 'bot'
  timestamp: string
  type?: 'text' | 'suggestion' | 'link'
  suggestions?: string[]
}

export interface ChatSession {
  id: string
  userId: string
  messages: ChatMessage[]
  createdAt: string
  lastActivity: string
}

class ChatbotService {
  private knowledgeBase: { [key: string]: string[] } = {
    // General Questions
    'bonjour': [
      'Bonjour! Comment puis-je vous aider aujourd\'hui?',
      'Bonjour! Je suis votre assistant virtuel. Que puis-je faire pour vous?',
      'Bonjour! Bienvenue dans l\'application School Management. Comment puis-je vous assister?'
    ],
    'salut': [
      'Salut! Comment ça va?',
      'Salut! En quoi puis-je vous aider?'
    ],
    'merci': [
      'Je vous en prie! N\'hésitez pas si vous avez d\'autres questions.',
      'Avec plaisir! Je suis là pour vous aider.',
      'De rien! C\'est mon rôle de vous assister.'
    ],
    
    // School Management
    'école': [
      'Notre école est un établissement d\'excellence dédié à la réussite de tous les élèves.',
      'L\'école offre un environnement d\'apprentissage moderne et stimulant.'
    ],
    'directeur': [
      'Le directeur de l\'école gère l\'administration et veille au bon fonctionnement de l\'établissement.',
      'Pour contacter la direction, vous pouvez passer par le secrétariat.'
    ],
    
    // Students
    'élève': [
      'Les élèves peuvent accéder à leurs notes, devoirs et emplois du temps via l\'application.',
      'Chaque élève dispose d\'un espace personnel pour suivre sa scolarité.'
    ],
    'inscription': [
      'Les inscriptions se font en ligne via l\'application ou au secrétariat.',
      'Pour inscrire un nouvel élève, veuillez contacter l\'administration.'
    ],
    'absen': [
      'Pour signaler une absence, utilisez l\'onglet "Attendance" ou contactez le secrétariat.',
      'Les absences doivent être justifiées dans les 48 heures.'
    ],
    
    // Grades
    'note': [
      'Les notes sont disponibles dans l\'onglet "Grades". Vous pouvez voir les moyennes par matière.',
      'Pour consulter les notes, allez dans "Grades" puis sélectionnez la classe et l\'élève.'
    ],
    'moyenn': [
      'La moyenne se calcule en divisant la somme des notes par le nombre de notes.',
      'Vous pouvez voir les moyennes dans l\'onglet "Analytics".'
    ],
    'bulletin': [
      'Les bulletins de notes sont disponibles dans l\'onglet "Bulletins".',
      'Vous pouvez générer et télécharger les bulletins en PDF.'
    ],
    
    // Homework
    'devoir': [
      'Les devoirs sont listés dans l\'onglet "Devoirs". Les professeurs peuvent en créer de nouveaux.',
      'Pour ajouter un devoir, allez dans "Devoirs" puis cliquez sur "Nouveau devoir".'
    ],
    'devoirs': [
      'Consultez l\'onglet "Devoirs" pour voir tous les devoirs assignés.',
      'Les devoirs peuvent être triés par classe et par date d\'échéance.'
    ],
    
    // Timetable
    'emploi': [
      'L\'emploi du temps est disponible dans l\'onglet "Timetable".',
      'Vous pouvez générer automatiquement les emplois du temps ou les modifier manuellement.'
    ],
    'cours': [
      'Les horaires de cours sont définis dans l\'emploi du temps de chaque classe.',
      'Les cours sont généralement de 55 minutes avec des pauses de 10 minutes.'
    ],
    
    // Payments
    'paiement': [
      'Les paiements peuvent être enregistrés dans l\'onglet "Paiements".',
      'Vous pouvez suivre les paiements effectués et les restes à payer.'
    ],
    'frais': [
      'Les frais scolaires incluent l\'inscription, les mensualités, le transport et la cantine.',
      'Pour créer de nouveaux frais, allez dans "Paiements" puis "Nouveaux frais".'
    ],
    'factur': [
      'Les factures sont générées automatiquement lors de la création de frais.',
      'Vous pouvez exporter les factures en PDF depuis l\'onglet "Paiements".'
    ],
    
    // Library
    'livr': [
      'La bibliothèque est accessible via l\'onglet "Bibliothèque".',
      'Vous pouvez emprunter et retourner des livres depuis l\'application.'
    ],
    'bibliothè': [
      'La bibliothèque contient des livres classés par catégorie.',
      'Pour emprunter un livre, cliquez sur "Emprunter" dans la fiche du livre.'
    ],
    
    // SMS
    'sms': [
      'Les SMS peuvent être envoyés depuis l\'onglet "SMS".',
      'Vous pouvez envoyer des SMS individuels ou en masse aux parents.'
    ],
    'messag': [
      'Les messages internes sont disponibles dans l\'onglet "Messages".',
      'Vous pouvez envoyer des messages aux professeurs, élèves et parents.'
    ],
    
    // Gamification
    'point': [
      'Le système de points est disponible dans l\'onglet "Gamification".',
      'Les élèves gagnent des points pour leurs bonnes performances et comportements.'
    ],
    'badge': [
      'Les badges sont débloqués automatiquement quand un élève atteint certains objectifs.',
      'Consultez l\'onglet "Gamification" pour voir tous les badges disponibles.'
    ],
    'classement': [
      'Le classement des élèves est visible dans l\'onglet "Gamification".',
      'Le classement se base sur le nombre total de points accumulés.'
    ],
    
    // Technical
    'problèm': [
      'Si vous rencontrez un problème, veuillez contacter l\'administrateur.',
      'Pour signaler un bug, utilisez le formulaire de contact ou contactez le support technique.'
    ],
    'bug': [
      'Pour signaler un bug, veuillez décrire le problème en détail.',
      'Contactez le support technique pour résoudre les problèmes techniques.'
    ],
    'aid': [
      'Je suis là pour vous aider! Posez-moi une question sur l\'école, les notes, les devoirs, etc.',
      'N\'hésitez pas à me poser des questions sur toutes les fonctionnalités de l\'application.'
    ],
    
    // Backup & Security
    'sauvegard': [
      'Les sauvegardes sont disponibles dans "Settings" → "Sauvegarde".',
      'Il est recommandé de faire des sauvegardes régulières de vos données.'
    ],
    'sécurit': [
      'La sécurité est assurée par la double authentification (2FA).',
      'Activez la 2FA dans "Settings" → "Sécurité" pour protéger votre compte.'
    ],
    '2fa': [
      'La double authentification (2FA) ajoute une couche de sécurité supplémentaire.',
      'Pour activer la 2FA, allez dans "Settings" → "Sécurité" puis cliquez sur "Activer 2FA".'
    ]
  }

  private fallbackResponses = [
    'Je ne suis pas sûr de comprendre. Pouvez-vous reformuler votre question?',
    'Je n\'ai pas trouvé de réponse à cette question. Essayez de poser une question sur l\'école, les notes, les devoirs, etc.',
    'Je suis un assistant virtuel et je peux vous aider avec les questions sur l\'école. Posez-moi une question plus spécifique.',
    'Je ne comprends pas bien. Essayez avec des mots-clés comme "notes", "devoirs", "emploi du temps", "paiements", etc.'
  ]

  /**
   * Get a response from the chatbot
   */
  async getResponse(message: string, context?: any): Promise<ChatMessage> {
    const lowerMessage = message.toLowerCase().trim()
    
    // Find matching response
    let response = this.findMatchingResponse(lowerMessage)
    
    // If no match, use fallback
    if (!response) {
      response = this.fallbackResponses[Math.floor(Math.random() * this.fallbackResponses.length)]
    }

    // Generate suggestions based on the query
    const suggestions = this.generateSuggestions(lowerMessage)

    return {
      id: this.generateId(),
      text: response,
      sender: 'bot',
      timestamp: new Date().toISOString(),
      type: suggestions.length > 0 ? 'suggestion' : 'text',
      suggestions
    }
  }

  /**
   * Find matching response from knowledge base
   */
  private findMatchingResponse(message: string): string | null {
    for (const [keywords, responses] of Object.entries(this.knowledgeBase)) {
      if (message.includes(keywords)) {
        return responses[Math.floor(Math.random() * responses.length)]
      }
    }
    
    // Try partial matching
    const words = message.split(' ')
    for (const word of words) {
      if (word.length > 3) {
        for (const [keywords, responses] of Object.entries(this.knowledgeBase)) {
          if (keywords.includes(word) || word.includes(keywords)) {
            return responses[Math.floor(Math.random() * responses.length)]
          }
        }
      }
    }
    
    return null
  }

  /**
   * Generate suggestions based on query
   */
  private generateSuggestions(message: string): string[] {
    const suggestionsMap: { [key: string]: string[] } = {
      'bonjour': ['Comment ça va?', 'Que puis-je faire pour vous?', 'Parlez-moi de l\'école'],
      'note': ['Voir les moyennes', 'Consulter les bulletins', 'Exporter les notes'],
      'devoir': ['Créer un devoir', 'Voir les devoirs en retard', 'Notifier les parents'],
      'paiement': ['Enregistrer un paiement', 'Voir les retards', 'Exporter les factures'],
      'emploi': ['Générer un emploi du temps', 'Modifier un cours', 'Imprimer l\'emploi du temps'],
      'absen': ['Signaler une absence', 'Voir les absences', 'Envoyer un SMS aux parents'],
      '': ['Voir les notes', 'Créer un devoir', 'Générer un emploi du temps', 'Envoyer un SMS']
    }

    for (const [keyword, suggestions] of Object.entries(suggestionsMap)) {
      if (message.includes(keyword)) {
        return suggestions
      }
    }

    return suggestionsMap['']
  }

  /**
   * Start a new chat session
   */
  startSession(userId: string): ChatSession {
    const session: ChatSession = {
      id: this.generateId(),
      userId,
      messages: [{
        id: this.generateId(),
        text: 'Bonjour! Je suis votre assistant virtuel. Comment puis-je vous aider aujourd\'hui?',
        sender: 'bot',
        timestamp: new Date().toISOString(),
        suggestions: ['Voir les notes', 'Créer un devoir', 'Générer un emploi du temps', 'Envoyer un SMS']
      }],
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    }

    return session
  }

  /**
   * Add message to session
   */
  addMessage(session: ChatSession, message: ChatMessage): void {
    session.messages.push(message)
    session.lastActivity = new Date().toISOString()
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}

// Export singleton instance
export const chatbotService = new ChatbotService()

// Export factory function
export const createChatbotService = (): ChatbotService => new ChatbotService()

export default chatbotService

