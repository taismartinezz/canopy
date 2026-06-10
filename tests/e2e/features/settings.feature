Feature: Settings page

  Scenario: Settings page loads
    Given I am logged in
    When I navigate to /settings
    Then the page should load without errors
    And I should see a profile section

  Scenario: PI sees invite code
    Given I am logged in as a PI
    When I navigate to /settings
    Then I should see my lab invite code

  Scenario: Researcher does not see invite code
    Given I am logged in as a researcher
    When I navigate to /settings
    Then I should not see an invite code section
