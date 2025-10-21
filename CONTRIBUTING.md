# Contributing to GammaLedger

First off, thank you for considering contributing to GammaLedger! It's people like you who make GammaLedger such a great tool for options traders worldwide.

## 📋 Table of Contents
- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)

## Code of Conduct

This project and everyone participating in it is governed by respect, collaboration, and inclusiveness. By participating, you are expected to uphold this standard. Please report unacceptable behavior to the project maintainers.

## How Can I Contribute?

### 🐛 Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples** (screenshots, code snippets)
- **Describe the behavior you observed and what you expected**
- **Include browser version and operating system**
- **Include any error messages from browser console**

### 💡 Suggesting Features

Feature suggestions are welcome! Please:

- **Use a clear and descriptive title**
- **Provide a detailed description of the suggested feature**
- **Explain why this feature would be useful** to most GammaLedger users
- **List any alternative solutions or features** you've considered
- **Include mockups or examples** if applicable

### 🔧 Code Contributions

#### Areas Where We Need Help

- **Bug Fixes**: Browse open issues with the `bug` label
- **New Strategy Support**: Add support for butterflies, calendars, diagonals
- **Broker Integrations**: Add import support for TD Ameritrade, Schwab, E*TRADE
- **UI/UX Improvements**: Enhance the interface and user experience
- **Documentation**: Improve README, add tutorials, create video guides
- **Testing**: Write unit tests and integration tests
- **Internationalization**: Translate to other languages
- **AI Coach Enhancements**: Improve trade analysis and coaching features
- **Performance Optimization**: Speed up calculations and rendering
- **Accessibility**: Make the app more accessible to all users

## Development Setup

### Prerequisites

- Modern web browser (Chrome, Firefox, or Edge)
- Text editor or IDE (VS Code recommended)
- Basic knowledge of HTML, CSS, and JavaScript
- Git for version control

### Local Setup

1. **Fork the repository** on GitHub

2. **Clone your fork** to your local machine:
```bash
git clone https://github.com/YOUR-USERNAME/GammaLedger.git
cd GammaLedger
```

3. **Create a branch** for your feature:
```bash
git checkout -b feature/your-feature-name
```

4. **Open the application**:
   - Simply open `index.html` in your browser
   - No build process required!
   - Use browser DevTools for debugging

5. **Make your changes** and test thoroughly

6. **Commit your changes**:
```bash
git add .
git commit -m "Add: Brief description of your changes"
```

7. **Push to your fork**:
```bash
git push origin feature/your-feature-name
```

8. **Create a Pull Request** on GitHub


## Pull Request Process

1. **Ensure your code follows** the coding standards (see below)

2. **Update documentation** for any changed functionality

3. **Add tests** if applicable

4. **Test in multiple browsers**:
   - Chrome/Edge
   - Firefox
   - Safari (if possible)

5. **Update the README.md** if you've added features

6. **Write a clear PR description**:
   - What changes you made
   - Why you made them
   - How to test them
   - Screenshots/videos if UI changes

7. **Link any related issues** (e.g., "Fixes #123")

8. **Be responsive** to feedback and review comments

### PR Review Criteria

Your PR will be evaluated on:
- **Code quality**: Clean, readable, well-commented
- **Functionality**: Works as intended without bugs
- **Testing**: Adequately tested across browsers
- **Documentation**: Changes are documented
- **Compatibility**: Doesn't break existing features
- **Performance**: Doesn't negatively impact app speed

## Coding Standards

### General Principles

- **Use vanilla JavaScript** - no frameworks or heavy libraries
- **ES6+ features** are encouraged (const/let, arrow functions, template literals)
- **Avoid global variables** - use modules and closures
- **Use meaningful variable names** - descriptive over clever

## Testing Guidelines

### Manual Testing

Before submitting a PR, manually test:

1. **Basic Functionality**
   - Can create new trades
   - Can edit existing trades
   - Can delete trades
   - Can import/export data

2. **Browser Compatibility**
   - Chrome/Edge (latest)
   - Firefox (latest)
   - Safari (latest, if possible)

3. **Responsiveness**
   - Desktop (1920x1080, 1366x768)
   - Tablet (768px width)
   - Mobile (375px width)

4. **Performance**
   - Load time acceptable
   - Smooth scrolling
   - No lag with 1000+ trades

5. **Error Handling**
   - Invalid inputs handled gracefully
   - Import errors display helpful messages
   - Database errors don't crash app

### Automated Testing

(Coming soon - help us build the test suite!)

## Documentation

### Code Documentation

- **Add JSDoc comments** to all public functions
- **Explain complex algorithms** with inline comments
- **Keep comments up-to-date** when code changes

### README Updates

When adding features, update:
- Feature list
- Usage instructions
- Screenshots (if UI changes)
- FAQ (if new common questions)

### Creating Tutorials

Help new users by creating:
- **Video tutorials** (upload to YouTube)
- **Blog posts** (add to `docs/` folder)
- **Example workflows** (common trading scenarios)

## Questions?

- **Create an issue** with the `question` label
- **Start a discussion** in GitHub Discussions
- **Review existing docs** in the repository's Wiki

## Recognition

Contributors are recognized in:
- Release notes
- Contributors section (coming soon)
- Special mentions for significant contributions

---

## Thank You! 🙏

Your contributions make GammaLedger better for thousands of options traders worldwide. Whether you're fixing a typo or adding a major feature, every contribution matters!

**Happy coding & trading!** 🚀