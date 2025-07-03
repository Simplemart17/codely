import type { Language } from '@/types';

export interface SessionTemplate {
  id: string;
  name: string;
  description: string;
  language: Language;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  estimatedDuration: number; // in minutes
  objectives: string[];
  tags: string[];
  prerequisites?: string;
  starterCode: string;
  category: 'FUNDAMENTALS' | 'WEB_DEVELOPMENT' | 'DATA_STRUCTURES' | 'ALGORITHMS' | 'PROJECT_BASED' | 'INTERVIEW_PREP';
}

export const SESSION_TEMPLATES: SessionTemplate[] = [
  // JavaScript Templates
  {
    id: 'js-basics',
    name: 'JavaScript Fundamentals',
    description: 'Learn the basics of JavaScript including variables, functions, and control structures',
    language: 'JAVASCRIPT',
    difficulty: 'BEGINNER',
    estimatedDuration: 60,
    objectives: [
      'Understand JavaScript variables and data types',
      'Learn function declaration and expressions',
      'Master conditional statements and loops',
      'Practice with arrays and objects'
    ],
    tags: ['javascript', 'fundamentals', 'variables', 'functions'],
    prerequisites: 'Basic understanding of programming concepts',
    starterCode: `// JavaScript Fundamentals Session
// Let's start with variables and basic operations

// 1. Variables and Data Types
let message = "Hello, World!";
const pi = 3.14159;
let isLearning = true;

console.log("Message:", message);
console.log("Pi:", pi);
console.log("Is Learning:", isLearning);

// 2. Functions
function greetUser(name) {
    return \`Hello, \${name}! Welcome to JavaScript.\`;
}

// Try calling the function:
// console.log(greetUser("Your Name"));

// 3. Your turn: Create a function that calculates the area of a circle
// function calculateCircleArea(radius) {
//     // Your code here
// }`,
    category: 'FUNDAMENTALS'
  },
  {
    id: 'js-dom-manipulation',
    name: 'DOM Manipulation with JavaScript',
    description: 'Learn how to interact with HTML elements using JavaScript',
    language: 'JAVASCRIPT',
    difficulty: 'INTERMEDIATE',
    estimatedDuration: 90,
    objectives: [
      'Select and modify HTML elements',
      'Handle user events',
      'Create dynamic content',
      'Build interactive web features'
    ],
    tags: ['javascript', 'dom', 'events', 'web-development'],
    prerequisites: 'Basic JavaScript knowledge and HTML/CSS understanding',
    starterCode: `// DOM Manipulation Session
// Learn to make web pages interactive!

// 1. Selecting Elements
const heading = document.querySelector('h1');
const buttons = document.querySelectorAll('button');

// 2. Modifying Content
if (heading) {
    heading.textContent = 'Welcome to Interactive JavaScript!';
    heading.style.color = '#007bff';
}

// 3. Event Handling
function handleButtonClick(event) {
    console.log('Button clicked:', event.target.textContent);
    event.target.style.backgroundColor = '#28a745';
}

// 4. Your turn: Add event listeners to buttons
// buttons.forEach(button => {
//     button.addEventListener('click', handleButtonClick);
// });

// 5. Create a simple counter
let count = 0;
function updateCounter() {
    // Your code here
}`,
    category: 'WEB_DEVELOPMENT'
  },
  
  // Python Templates
  {
    id: 'python-basics',
    name: 'Python Programming Fundamentals',
    description: 'Introduction to Python syntax, data types, and basic programming concepts',
    language: 'PYTHON',
    difficulty: 'BEGINNER',
    estimatedDuration: 75,
    objectives: [
      'Learn Python syntax and indentation',
      'Understand data types and variables',
      'Master lists, dictionaries, and tuples',
      'Practice with functions and modules'
    ],
    tags: ['python', 'fundamentals', 'data-types', 'functions'],
    prerequisites: 'No prior programming experience required',
    starterCode: `# Python Fundamentals Session
# Welcome to Python programming!

# 1. Variables and Data Types
name = "Python Learner"
age = 25
height = 5.8
is_student = True

print(f"Name: {name}")
print(f"Age: {age}")
print(f"Height: {height}")
print(f"Is Student: {is_student}")

# 2. Lists and Dictionaries
fruits = ["apple", "banana", "orange"]
person = {
    "name": "Alice",
    "age": 30,
    "city": "New York"
}

print("Fruits:", fruits)
print("Person:", person)

# 3. Functions
def calculate_area(length, width):
    """Calculate the area of a rectangle."""
    return length * width

# Try the function:
# area = calculate_area(10, 5)
# print(f"Area: {area}")

# 4. Your turn: Create a function to find the largest number in a list
def find_largest(numbers):
    # Your code here
    pass

# Test your function:
# test_numbers = [3, 7, 2, 9, 1]
# largest = find_largest(test_numbers)
# print(f"Largest number: {largest}")`,
    category: 'FUNDAMENTALS'
  },
  {
    id: 'python-data-analysis',
    name: 'Data Analysis with Python',
    description: 'Learn data manipulation and analysis using Python libraries',
    language: 'PYTHON',
    difficulty: 'INTERMEDIATE',
    estimatedDuration: 120,
    objectives: [
      'Work with pandas for data manipulation',
      'Perform basic statistical analysis',
      'Create data visualizations',
      'Handle CSV and JSON data'
    ],
    tags: ['python', 'data-analysis', 'pandas', 'statistics'],
    prerequisites: 'Basic Python knowledge and familiarity with data concepts',
    starterCode: `# Data Analysis with Python Session
# Learn to work with data using Python!

import pandas as pd
import numpy as np

# 1. Creating DataFrames
data = {
    'name': ['Alice', 'Bob', 'Charlie', 'Diana'],
    'age': [25, 30, 35, 28],
    'salary': [50000, 60000, 70000, 55000],
    'department': ['IT', 'HR', 'IT', 'Finance']
}

df = pd.DataFrame(data)
print("Employee Data:")
print(df)

# 2. Basic Data Analysis
print(f"\\nAverage age: {df['age'].mean()}")
print(f"Average salary: {df['salary'].mean()}")
print(f"\\nDepartment counts:")
print(df['department'].value_counts())

# 3. Data Filtering
it_employees = df[df['department'] == 'IT']
print(f"\\nIT Employees:")
print(it_employees)

# 4. Your turn: Find employees with salary > 55000
high_earners = df[df['salary'] > 55000]
# print("High earners:")
# print(high_earners)

# 5. Challenge: Calculate average salary by department
# avg_salary_by_dept = df.groupby('department')['salary'].mean()
# print("\\nAverage salary by department:")
# print(avg_salary_by_dept)`,
    category: 'DATA_STRUCTURES'
  },

  // C# Templates
  {
    id: 'csharp-basics',
    name: 'C# Programming Fundamentals',
    description: 'Learn C# syntax, object-oriented programming, and .NET basics',
    language: 'CSHARP',
    difficulty: 'BEGINNER',
    estimatedDuration: 90,
    objectives: [
      'Understand C# syntax and structure',
      'Learn object-oriented programming concepts',
      'Master classes and methods',
      'Practice with collections and LINQ'
    ],
    tags: ['csharp', 'oop', 'dotnet', 'fundamentals'],
    prerequisites: 'Basic programming concepts helpful but not required',
    starterCode: `// C# Programming Fundamentals Session
// Welcome to C# and .NET!

using System;
using System.Collections.Generic;
using System.Linq;

namespace CSharpFundamentals
{
    // 1. Class Definition
    public class Person
    {
        public string Name { get; set; }
        public int Age { get; set; }
        
        public Person(string name, int age)
        {
            Name = name;
            Age = age;
        }
        
        public void Introduce()
        {
            Console.WriteLine($"Hi, I'm {Name} and I'm {Age} years old.");
        }
    }
    
    class Program
    {
        static void Main(string[] args)
        {
            // 2. Creating Objects
            var person1 = new Person("Alice", 25);
            var person2 = new Person("Bob", 30);
            
            person1.Introduce();
            person2.Introduce();
            
            // 3. Collections
            var numbers = new List<int> { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 };
            
            // 4. LINQ Examples
            var evenNumbers = numbers.Where(n => n % 2 == 0).ToList();
            Console.WriteLine($"Even numbers: {string.Join(", ", evenNumbers)}");
            
            // 5. Your turn: Create a method to calculate factorial
            // static int CalculateFactorial(int n)
            // {
            //     // Your code here
            // }
            
            Console.WriteLine("Press any key to exit...");
            Console.ReadKey();
        }
    }
}`,
    category: 'FUNDAMENTALS'
  },

  // Algorithm Templates
  {
    id: 'sorting-algorithms',
    name: 'Sorting Algorithms Implementation',
    description: 'Learn and implement common sorting algorithms',
    language: 'JAVASCRIPT',
    difficulty: 'INTERMEDIATE',
    estimatedDuration: 120,
    objectives: [
      'Understand time and space complexity',
      'Implement bubble sort and selection sort',
      'Learn merge sort and quick sort',
      'Compare algorithm performance'
    ],
    tags: ['algorithms', 'sorting', 'complexity', 'performance'],
    prerequisites: 'Basic programming knowledge and understanding of arrays',
    starterCode: `// Sorting Algorithms Session
// Learn to implement and analyze sorting algorithms

// 1. Bubble Sort Implementation
function bubbleSort(arr) {
    const n = arr.length;
    const result = [...arr]; // Create a copy
    
    for (let i = 0; i < n - 1; i++) {
        for (let j = 0; j < n - i - 1; j++) {
            if (result[j] > result[j + 1]) {
                // Swap elements
                [result[j], result[j + 1]] = [result[j + 1], result[j]];
            }
        }
    }
    
    return result;
}

// 2. Test the algorithm
const testArray = [64, 34, 25, 12, 22, 11, 90];
console.log("Original array:", testArray);
console.log("Bubble sorted:", bubbleSort(testArray));

// 3. Your turn: Implement Selection Sort
function selectionSort(arr) {
    // Your implementation here
    const result = [...arr];
    
    // Hint: Find the minimum element and swap it with the first element
    // Then repeat for the rest of the array
    
    return result;
}

// 4. Challenge: Implement Quick Sort
function quickSort(arr) {
    // Your implementation here
    // Hint: Choose a pivot, partition the array, and recursively sort
}

// Test your implementations:
// console.log("Selection sorted:", selectionSort(testArray));
// console.log("Quick sorted:", quickSort(testArray));`,
    category: 'ALGORITHMS'
  }
];

export const SESSION_CATEGORIES = [
  { id: 'FUNDAMENTALS', name: 'Programming Fundamentals', description: 'Basic programming concepts and syntax' },
  { id: 'WEB_DEVELOPMENT', name: 'Web Development', description: 'Frontend and backend web technologies' },
  { id: 'DATA_STRUCTURES', name: 'Data Structures', description: 'Arrays, lists, trees, and other data structures' },
  { id: 'ALGORITHMS', name: 'Algorithms', description: 'Sorting, searching, and optimization algorithms' },
  { id: 'PROJECT_BASED', name: 'Project-Based Learning', description: 'Build real-world applications' },
  { id: 'INTERVIEW_PREP', name: 'Interview Preparation', description: 'Coding interview questions and techniques' }
] as const;

export function getTemplatesByLanguage(language: Language): SessionTemplate[] {
  return SESSION_TEMPLATES.filter(template => template.language === language);
}

export function getTemplatesByCategory(category: SessionTemplate['category']): SessionTemplate[] {
  return SESSION_TEMPLATES.filter(template => template.category === category);
}

export function getTemplatesByDifficulty(difficulty: SessionTemplate['difficulty']): SessionTemplate[] {
  return SESSION_TEMPLATES.filter(template => template.difficulty === difficulty);
}

export function getTemplateById(id: string): SessionTemplate | undefined {
  return SESSION_TEMPLATES.find(template => template.id === id);
}
