

export class TestSuite {
  #hostElement

  constructor(containerElement) {
    this.#hostElement = containerElement
  }

  test(name, testFunction) {
    return this.#runTest(name, testFunction, false)
  }

  testAsync(name, testFunction) {
    return this.#runTest(name, testFunction, true)
  }

  async #runTest(name, testFunction, isAsync) {

    // TODO: this is the special case!

    const testContainer = document.createElement('article')
    this.#hostElement.appendChild(testContainer)
    testContainer.classList.add('test')

    const header = document.createElement('header')
    testContainer.appendChild(header)

    const testName = document.createElement('pre')
    testName.classList.add('test-name')
    testName.classList.add('html-escape')
    header.appendChild(testName)
    testName.innerText = (name)

    const testResult = document.createElement('span')
    testResult.classList.add('test-result')
    header.appendChild(testResult)

    const errorDescription = document.createElement('section')
    testContainer.appendChild(errorDescription)
    errorDescription.classList.add('test-error-description')

    const nestedTests = document.createElement('section')
    nestedTests.classList.add('test-cases')
    testContainer.appendChild(nestedTests)

    const nestedTestSuite = new TestSuite(nestedTests);

    try {
      const testContext = {
        case(caseName, testFunction) {
          return nestedTestSuite.test(caseName, testFunction)
        },

        caseAsync(caseName, testFunction) {
          return nestedTestSuite.testAsync(caseName, testFunction)
        },

        each(data, eachFunction) {
          const count = data.length
          return data.forEach((d, i) => eachFunction(testContext, d, i, count))
        },

        async eachAsync(data, eachFunction) {
          const count = data.length
          for (let i = 0; i < count; i++) {
            await eachFunction(testContext, data[i], i, count)
          }
        },
      }

      if (isAsync) {
        await testFunction(testContext)
      } else {
        testFunction(testContext)
      }
      testContainer.classList.add('test-passed')
      testResult.innerHTML = 'OK'
    }
    catch (error) {
      testResult.innerHTML = 'FAILED'
      testContainer.classList.add('test-failed')

      console.log(`Test failed: ${name}`)
      console.error(error)

      const errorElement = document.createElement('pre')
      errorElement.classList.add('html-escape')
      errorDescription.append(errorElement)

      const errorMessage = [error.message]
      if (error.assertionMessage) errorMessage.push(error.assertionMessage)
      errorElement.innerText = errorMessage.join(' - ').replace(/\n/g, "\\n")
    }
  }
}

export class AssertionError extends Error {
  assertionMessage
  constructor(message, assertionMessage) {
    super(message)
    this.name = this.constructor.name
    this.assertionMessage = assertionMessage
  }
}

export function isEqual(expected, result, message) {
  if (expected === result) return
  throw new AssertionError(`expected '${expected}' but got '${result}'`, message)
}

export function arrayIsEqual(expected, result, message) {
  if (expected.every((val, idx) => val === result[idx])) return
  throw new Error(`expected '${expected}' but got '${result}'.  ${message}`)
}

export function expectReadPosition(position, col, line, reader) {
  isEqual(position, reader.position, `expect position to be: ${position}}`)
  isEqual(col, reader.col, `expect col to be: ${col}}`)
  isEqual(line, reader.line, `expect col to be: ${line}}`)
}

export function expectPeekValues(peek, peekNext, reader) {
  isEqual(peek, reader.peek(), `expect peek() to be: ${peek}}`)
  isEqual(peekNext, reader.peekNext(), `expect peekNext() to be: ${peekNext}}`)
}

export function throwsError(predicate) {
  try {
    predicate()
    throw new Error(`expected an error to be thrown`)
  }
  catch (error) {
  }
}
