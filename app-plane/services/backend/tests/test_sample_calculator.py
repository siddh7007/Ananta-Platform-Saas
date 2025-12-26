"""
Sample Calculator Tests - WITH INTENTIONAL BUGS

These tests have bugs so the AI can analyze and fix them.
This demonstrates the AI-powered development cycle.
"""

import pytest


class Calculator:
    """Simple calculator with intentional bugs"""

    def add(self, a, b):
        """Add two numbers - HAS BUG: returns wrong result"""
        return a + b + 1  # BUG: Adding 1 extra!

    def subtract(self, a, b):
        """Subtract b from a"""
        return a - b

    def multiply(self, a, b):
        """Multiply two numbers - HAS BUG: wrong operation"""
        return a + b  # BUG: Should multiply, not add!

    def divide(self, a, b):
        """Divide a by b - HAS BUG: no zero check"""
        return a / b  # BUG: Will crash if b is 0!

    def power(self, base, exponent):
        """Raise base to exponent - HAS BUG: wrong operator"""
        return base * exponent  # BUG: Should use **, not *!


@pytest.fixture
def calc():
    """Create calculator instance"""
    return Calculator()


def test_addition(calc):
    """Test addition - WILL FAIL due to bug"""
    assert calc.add(2, 3) == 5, "2 + 3 should equal 5"
    assert calc.add(10, 20) == 30, "10 + 20 should equal 30"
    assert calc.add(-5, 5) == 0, "-5 + 5 should equal 0"


def test_subtraction(calc):
    """Test subtraction - WILL PASS (no bug)"""
    assert calc.subtract(10, 3) == 7, "10 - 3 should equal 7"
    assert calc.subtract(5, 10) == -5, "5 - 10 should equal -5"


def test_multiplication(calc):
    """Test multiplication - WILL FAIL due to bug"""
    assert calc.multiply(3, 4) == 12, "3 * 4 should equal 12"
    assert calc.multiply(5, 6) == 30, "5 * 6 should equal 30"


def test_division(calc):
    """Test division - WILL PASS for normal cases"""
    assert calc.divide(10, 2) == 5, "10 / 2 should equal 5"
    assert calc.divide(20, 4) == 5, "20 / 4 should equal 5"


def test_division_by_zero(calc):
    """Test division by zero - WILL FAIL (no error handling)"""
    with pytest.raises(ZeroDivisionError):
        calc.divide(10, 0)


def test_power(calc):
    """Test power function - WILL FAIL due to bug"""
    assert calc.power(2, 3) == 8, "2^3 should equal 8"
    assert calc.power(5, 2) == 25, "5^2 should equal 25"
    assert calc.power(10, 0) == 1, "10^0 should equal 1"
